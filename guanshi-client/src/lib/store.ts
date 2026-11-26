import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'
import { create } from 'zustand'
import { ApiError, DEFAULT_API_BASE, api, getApiBase, setApiBase, setToken } from './api'
import { addDaysISO, firstLine, localDateOf, todayISO } from './format'
import {
  clearPendingShare,
  drainNotifications,
  inferSource,
  markSmsSeen,
  pickImage,
  readSmsSince,
  recognizeImage,
  smsLastSeen,
} from './native'
import { seedBootstrap } from './seed'
import { ensureStream, stopStream, type StreamMessage } from './stream'
import type {
  Bootstrap,
  Collection,
  Duty,
  Family,
  Festival,
  Memory,
  Message,
  SharePayload,
  Stats,
  User,
} from './types'
import type { ThemeMode } from '@/src/theme/tokens'

const SETTINGS_KEY = 'guanshi.settings.v1'
const CACHE_KEY = 'guanshi.cache.v1'
const DEVICE_KEY = 'guanshi.device.v1'
const TOKEN_KEY = 'guanshi.token.v1'
const IFLYTEK_KEY = 'guanshi.iflytek.v1'
const LLM_KEY = 'guanshi.llm.v1'

export interface LlmSettings {
  baseUrl: string
  model: string
  apiKey: string
}

export interface Settings {
  apiBase: string
  theme: ThemeMode
  iflytek: { appId: string; apiKey: string; apiSecret: string }
  llm: LlmSettings
  sms: boolean
  notify: boolean
  push: boolean
  voice: boolean
  quiet: boolean
  onboarded: boolean
  reminderStyle: 'quiet' | 'standard' | 'active'
}

const defaultSettings: Settings = {
  apiBase: DEFAULT_API_BASE,
  theme: 'system',
  iflytek: { appId: '', apiKey: '', apiSecret: '' },
  llm: { baseUrl: 'https://api.deepseek.com', model: '', apiKey: '' },
  sms: false,
  notify: false,
  push: true,
  voice: true,
  quiet: true,
  onboarded: false,
  reminderStyle: 'standard',
}

export interface DialogState {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string | null
  tone?: 'default' | 'danger'
}

interface AppState {
  hydrated: boolean
  token: string | null
  deviceId: string
  online: boolean
  user: User | null
  stats: Stats
  duties: Duty[]
  messages: Message[]
  collections: Collection[]
  memories: Memory[]
  family: Family[]
  festivals: Festival[]
  unread: number
  settings: Settings
  toast: string | null
  dialog: DialogState | null
  chatLoading: boolean
  highlight: string | null
  refreshing: boolean

  hydrate: () => Promise<void>
  refresh: () => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  setTheme: (mode: ThemeMode) => Promise<void>
  completeOnboarding: () => Promise<void>
  showToast: (text: string | null) => void
  confirm: (options: DialogState) => Promise<boolean>
  resolveDialog: (ok: boolean) => void
  markRead: () => void

  toggleDuty: (id: string) => Promise<void>
  confirmDuty: (id: string) => Promise<void>
  dropDuty: (id: string) => Promise<void>
  snoozeDuty: (id: string) => Promise<void>
  addDuty: (input: Partial<Duty> & { title: string }) => Promise<Duty | null>
  sendChat: (text: string) => Promise<void>
  clearChat: () => Promise<void>
  setHighlight: (id: string | null) => void

  addCollection: (input: Partial<Collection> & { title: string }) => Promise<Collection | null>
  reviewCollection: (id: string) => Promise<void>
  removeCollection: (id: string) => Promise<void>
  addMemory: (kind: string, text: string) => Promise<void>
  forgetMemory: (id: string) => Promise<void>
  handleShare: (payload: SharePayload) => Promise<void>
  ingestDeviceData: () => Promise<void>
  ingestScreenshot: () => Promise<void>
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

let dialogResolver: ((ok: boolean) => void) | null = null

function emptyStats(): Stats {
  return { weekRate: 0, weekDelta: 0, streak: 0, nextPush: '18:00', todayTotal: 0, todayDone: 0, collectionInbox: 0 }
}

function computeStats(duties: Duty[], collections: Collection[], previous: Stats): Stats {
  const today = todayISO()
  const todayDuties = duties.filter((d) => d.date === today && d.status !== 'dropped')
  const doneToday = todayDuties.filter((d) => d.status === 'done')
  const weekStart = addDaysISO(-6)
  const weekDuties = duties.filter((d) => d.date >= weekStart && d.date <= today && d.status !== 'dropped')
  const weekDone = weekDuties.filter((d) => d.status === 'done').length
  const rate = weekDuties.length ? Math.round((weekDone / weekDuties.length) * 100) : 0
  const doneDays = new Set(duties.filter((d) => d.doneAt).map((d) => localDateOf(d.doneAt!)))
  let streak = 0
  for (let i = 0; i < 365; i += 1) {
    if (doneDays.has(addDaysISO(-i))) streak += 1
    else if (i > 0) break
  }
  return {
    weekRate: rate,
    weekDelta: Math.min(20, Math.max(-20, Math.round(rate / 8))),
    streak: streak || 1,
    nextPush: previous.nextPush || '18:00',
    todayTotal: todayDuties.length,
    todayDone: doneToday.length,
    collectionInbox: collections.filter((c) => c.status === 'inbox').length,
  }
}

function cacheOf(state: AppState): string {
  return JSON.stringify({
    user: state.user,
    stats: state.stats,
    duties: state.duties,
    messages: state.messages,
    collections: state.collections,
    memories: state.memories,
    family: state.family,
    unread: state.unread,
  })
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    await AsyncStorage.setItem(key, value)
  }
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return AsyncStorage.getItem(key)
  }
}

function parseCache(raw: string | null): Bootstrap | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Bootstrap
  } catch {
    return null
  }
}

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s]+|(?:v\.douyin\.com|xhslink\.com|mp\.weixin\.qq\.com)\/[^\s]+/)
  return match?.[0] || ''
}

/* ---------------- 前台推送（WebSocket） ---------------- */

const notifiedIds = new Set<string>()

async function onStreamMessage(message: StreamMessage): Promise<void> {
  if (message.messageId) {
    if (notifiedIds.has(message.messageId)) return
    notifiedIds.add(message.messageId)
    if (notifiedIds.size > 200) notifiedIds.clear()
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body.length > 120 ? `${message.body.slice(0, 120)}…` : message.body,
        data: { messageId: message.messageId },
      },
      trigger: null,
    })
  } catch {
    // 没有通知权限时静默，数据仍会刷新
  }
  await useApp.getState().refresh()
}

export const useApp = create<AppState>()((set, get) => ({
  hydrated: false,
  token: null,
  deviceId: '',
  online: false,
  user: null,
  stats: emptyStats(),
  duties: [],
  messages: [],
  collections: [],
  memories: [],
  family: [],
  festivals: [],
  unread: 0,
  settings: defaultSettings,
  toast: null,
  dialog: null,
  chatLoading: false,
  highlight: null,
  refreshing: false,

  hydrate: async () => {
    let settings = { ...defaultSettings }
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>
        settings = { ...settings, ...parsed, llm: settings.llm }
        delete (settings as Record<string, unknown>).modelLabel
      }
      const secure = await secureGet(IFLYTEK_KEY)
      if (secure) settings.iflytek = { ...settings.iflytek, ...JSON.parse(secure) }
      const llmRaw = await secureGet(LLM_KEY)
      if (llmRaw) settings.llm = { ...settings.llm, ...JSON.parse(llmRaw) }
    } catch {
      // 使用默认设置
    }

    let deviceId = (await AsyncStorage.getItem(DEVICE_KEY)) || ''
    if (!deviceId) {
      deviceId = `android-${Math.random().toString(36).slice(2, 12)}`
      await AsyncStorage.setItem(DEVICE_KEY, deviceId)
    }
    setApiBase(settings.apiBase)
    set({ settings, deviceId })

    const fallback = parseCache(await AsyncStorage.getItem(CACHE_KEY)) || seedBootstrap()
    set({
      user: fallback.user,
      stats: fallback.stats,
      duties: fallback.duties,
      messages: fallback.messages,
      collections: fallback.collections,
      memories: fallback.memories,
      family: fallback.family,
      festivals: fallback.festivals || [],
      unread: fallback.unread,
      hydrated: true,
    })

    try {
      let token = await secureGet(TOKEN_KEY)
      if (token) setToken(token)
      if (!token) {
        const result = await api.login(deviceId)
        token = result.token
        await secureSet(TOKEN_KEY, token)
        setToken(token)
      }
      let data: Bootstrap
      try {
        data = await api.bootstrap()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const result = await api.login(deviceId)
          await secureSet(TOKEN_KEY, result.token)
          setToken(result.token)
          token = result.token
          data = await api.bootstrap()
        } else {
          throw error
        }
      }
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data))
      set({
        token,
        online: true,
        user: data.user,
        stats: data.stats,
        duties: data.duties,
        messages: data.messages,
        collections: data.collections,
        memories: data.memories,
        family: data.family,
        festivals: data.festivals || [],
        unread: data.unread,
      })
      ensureStream(token, (message) => void onStreamMessage(message))
      void get().ingestDeviceData()
    } catch {
      setToken(null)
      set({ online: false, token: null })
    }
  },

  refresh: async () => {
    if (get().refreshing) return
    set({ refreshing: true })
    try {
      let data: Bootstrap
      try {
        data = await api.bootstrap()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const result = await api.login(get().deviceId)
          await secureSet(TOKEN_KEY, result.token)
          setToken(result.token)
          set({ token: result.token })
          data = await api.bootstrap()
        } else {
          throw error
        }
      }
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data))
      set({
        online: true,
        user: data.user,
        stats: data.stats,
        duties: data.duties,
        messages: data.messages,
        collections: data.collections,
        memories: data.memories,
        family: data.family,
        festivals: data.festivals || [],
        unread: data.unread,
      })
      const liveToken = get().token
      if (liveToken) ensureStream(liveToken, (message) => void onStreamMessage(message))
    } catch {
      set({ online: false })
    } finally {
      set({ refreshing: false })
    }
  },

  saveSettings: async (patch) => {
    const next: Settings = { ...get().settings, ...patch }
    set({ settings: next })
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...next, iflytek: undefined, llm: undefined }),
    )
    if (patch.iflytek) await secureSet(IFLYTEK_KEY, JSON.stringify(next.iflytek))
    if (patch.llm) await secureSet(LLM_KEY, JSON.stringify(next.llm))
    if (patch.apiBase) {
      stopStream()
      setApiBase(next.apiBase)
      setToken(null)
      set({ token: null })
      void get().refresh()
    }
  },

  setTheme: async (mode) => {
    await get().saveSettings({ theme: mode })
  },

  completeOnboarding: async () => {
    await get().saveSettings({ onboarded: true })
  },

  showToast: (text) => {
    set({ toast: text })
    if (text) {
      setTimeout(() => {
        if (get().toast === text) set({ toast: null })
      }, 2400)
    }
  },

  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      dialogResolver = resolve
      set({ dialog: options })
    }),

  resolveDialog: (ok) => {
    set({ dialog: null })
    const resolver = dialogResolver
    dialogResolver = null
    resolver?.(ok)
  },

  markRead: () => {
    if (!get().unread) return
    set({ unread: 0, messages: get().messages.map((m) => ({ ...m, read: 1 })) })
    if (get().online) void api.markRead().catch(() => undefined)
  },

  toggleDuty: async (id) => {
    const duty = get().duties.find((d) => d.id === id)
    if (!duty) return
    const nextStatus = duty.status === 'done' ? 'open' : 'done'
    const previous = duty
    set({
      duties: get().duties.map((d) =>
        d.id === id ? { ...d, status: nextStatus, doneAt: nextStatus === 'done' ? Date.now() : undefined } : d,
      ),
    })
    try {
      const result = nextStatus === 'done' ? await api.completeDuty(id) : await api.patchDuty(id, { status: 'open' })
      set({ duties: get().duties.map((d) => (d.id === id ? result.duty : d)) })
      set({ stats: computeStats(get().duties, get().collections, get().stats) })
    } catch {
      set({ duties: get().duties.map((d) => (d.id === id ? previous : d)), online: false })
      get().showToast('离线状态，稍后会同步')
    }
  },

  confirmDuty: async (id) => {
    const duty = get().duties.find((d) => d.id === id)
    if (!duty) return
    set({ duties: get().duties.map((d) => (d.id === id ? { ...d, status: 'open' } : d)) })
    try {
      const result = await api.patchDuty(id, { status: 'open' })
      set({ duties: get().duties.map((d) => (d.id === id ? result.duty : d)) })
      get().showToast('已加入今天的待办')
    } catch {
      get().showToast('已在本机确认，联网后同步')
    }
  },

  dropDuty: async (id) => {
    set({ duties: get().duties.map((d) => (d.id === id ? { ...d, status: 'dropped' } : d)) })
    try {
      await api.dropDuty(id)
    } catch {
      // 本地已隐藏
    }
    set({ stats: computeStats(get().duties, get().collections, get().stats) })
  },

  snoozeDuty: async (id) => {
    const duty = get().duties.find((d) => d.id === id)
    if (!duty) return
    const nextDate = addDaysISO(1)
    set({
      duties: get().duties.map((d) =>
        d.id === id ? { ...d, status: 'open', date: nextDate, timeLabel: '明天' } : d,
      ),
    })
    try {
      const result = await api.snoozeDuty(id)
      set({ duties: get().duties.map((d) => (d.id === id ? result.duty : d)) })
    } catch {
      // 本地已顺延
    }
    get().showToast('顺延到明天')
  },

  addDuty: async (input) => {
    try {
      const result = await api.createDuty(input)
      set({ duties: [...get().duties, result.duty] })
      set({ stats: computeStats(get().duties, get().collections, get().stats) })
      return result.duty
    } catch {
      const duty: Duty = {
        id: uid('local'),
        title: input.title,
        type: input.type || '其他',
        source: input.source || '手动',
        status: input.status || 'open',
        date: input.date || todayISO(),
        timeLabel: input.timeLabel || '今天',
        sort: input.sort ?? 1200,
        origin: input.origin || '手动创建',
        quote: input.quote || '',
        rule: input.rule || '到点提醒一次',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        history: [{ t: '刚刚', s: '手动创建' }],
      }
      set({ duties: [...get().duties, duty], online: false })
      set({ stats: computeStats(get().duties, get().collections, get().stats) })
      get().showToast('已保存在本机，联网后同步')
      return duty
    }
  },

  sendChat: async (text) => {
    const clean = text.trim()
    if (!clean) return
    const tempId = uid('tmp')
    const optimistic: Message = {
      id: tempId, role: 'me', text: clean, createdAt: Date.now(), read: 1,
    }
    set({ messages: [...get().messages, optimistic], chatLoading: true })
    try {
      const result = await api.chat(clean, get().settings.llm)
      const messages = [...get().messages.filter((m) => m.id !== tempId), ...result.messages]
      const duties = [...get().duties]
      for (const duty of [...result.duties, ...result.updated]) {
        const index = duties.findIndex((d) => d.id === duty.id)
        if (index >= 0) duties[index] = duty
        else duties.push(duty)
      }
      const memories = [...get().memories, ...result.memories]
      set({
        messages,
        duties,
        memories,
        online: true,
        chatLoading: false,
        highlight: result.messages[result.messages.length - 1]?.id ?? null,
      })
      set({ stats: computeStats(duties, get().collections, get().stats) })
      void AsyncStorage.setItem(CACHE_KEY, cacheOf(get()))
    } catch {
      const fallback = localChatFallback(clean)
      const duty: Duty | null = fallback.createDuty
        ? {
            id: uid('local'),
            title: fallback.createDuty.title,
            type: fallback.createDuty.type,
            source: '对话',
            status: 'open',
            date: fallback.createDuty.date,
            timeLabel: fallback.createDuty.timeLabel,
            sort: 1000,
            origin: '对话 · 离线创建',
            quote: `你说：${clean}`,
            rule: '按对话里的时间提醒一次',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            history: [{ t: '刚刚', s: '对话中创建待办' }],
          }
        : null
      const reply: Message = {
        id: uid('m'), role: 'ai', text: fallback.reply,
        kind: duty ? 'duty' : null, dutyId: duty?.id ?? null,
        createdAt: Date.now(), read: 0,
      }
      set({
        messages: [...get().messages.filter((m) => m.id !== tempId), optimistic, reply],
        duties: duty ? [...get().duties, duty] : get().duties,
        chatLoading: false,
        online: false,
        highlight: reply.id,
      })
      set({ stats: computeStats(get().duties, get().collections, get().stats) })
    }
  },

  clearChat: async () => {
    set({ messages: [] })
    try {
      await api.clearMessages()
      get().showToast('对话已清空')
    } catch {
      get().showToast('本机已清空，联网后会同步')
    }
  },

  setHighlight: (id) => set({ highlight: id }),

  addCollection: async (input) => {
    try {
      const result = await api.createCollection(input)
      const collections = [result.collection, ...get().collections]
      set({ collections })
      set({ stats: computeStats(get().duties, collections, get().stats) })
      return result.collection
    } catch {
      const collection: Collection = {
        id: uid('k'),
        type: input.type || 'link',
        source: input.source || '网页',
        status: 'inbox',
        title: input.title,
        excerpt: input.excerpt || '',
        url: input.url || '',
        note: input.note || '',
        imagePath: input.imagePath || null,
        meta: input.meta || '分享',
        createdAt: Date.now(),
      }
      const collections = [collection, ...get().collections]
      set({ collections })
      set({ stats: computeStats(get().duties, collections, get().stats) })
      return collection
    }
  },

  reviewCollection: async (id) => {
    set({ collections: get().collections.map((c) => (c.id === id ? { ...c, status: 'reviewed' } : c)) })
    try {
      await api.updateCollection(id, { status: 'reviewed' })
    } catch {
      // 本地已标记
    }
  },

  removeCollection: async (id) => {
    set({ collections: get().collections.filter((c) => c.id !== id) })
    try {
      await api.deleteCollection(id)
    } catch {
      // 本地已删除
    }
  },

  addMemory: async (kind, text) => {
    try {
      const result = await api.addMemory(kind, text)
      set({ memories: [result.memory, ...get().memories] })
    } catch {
      set({
        memories: [{ id: uid('m'), kind, text, createdAt: Date.now() }, ...get().memories],
      })
    }
  },

  forgetMemory: async (id) => {
    set({ memories: get().memories.filter((m) => m.id !== id) })
    try {
      await api.deleteMemory(id)
    } catch {
      // 本地已删除
    }
  },

  handleShare: async (payload) => {
    clearPendingShare()
    let text = payload.text || ''
    if (payload.kind === 'image' && payload.path) {
      const ocr = await recognizeImage(payload.path)
      text = ocr?.text || payload.text || '图片收藏'
    }
    const title = firstLine(text).slice(0, 60) || '新收藏'
    const source = inferSource(text)
    const collection = await get().addCollection({
      title,
      type: payload.kind === 'image' ? 'image' : 'link',
      source,
      excerpt: text.slice(0, 240),
      url: extractUrl(text),
      imagePath: payload.kind === 'image' ? payload.path ?? null : null,
      meta: payload.kind === 'image' ? '图片 · 分享' : '分享',
    })
    if (collection) get().showToast(`已收进收藏 · 来自${source}`)
  },

  ingestDeviceData: async () => {
    if (!get().online) return
    const settings = get().settings
    const events: { uid: string; kind: string; payload: Record<string, unknown> }[] = []
    if (settings.notify) {
      const notifications = await drainNotifications()
      notifications
        .filter((item) => item.text.trim().length >= 6)
        .slice(-8)
        .forEach((item, index) => {
          events.push({
            uid: `notify-${item.time}-${index}`,
            kind: 'notification',
            payload: { text: `${item.title} ${item.text}`, packageName: item.packageName, time: item.time },
          })
        })
    }
    if (settings.sms) {
      const last = await smsLastSeen()
      const since = last || Date.now() - 7 * 86400_000
      const list = await readSmsSince(since)
      markSmsSeen(Date.now())
      list
        .filter((item) => /快递|取件|驿站|预约|挂号|航班|车次|检票|缴费|到期/.test(item.body))
        .slice(-8)
        .forEach((item) => {
          events.push({
            uid: `sms-${item.date}-${item.address}`,
            kind: 'sms',
            payload: { text: item.body, address: item.address, time: item.date },
          })
        })
    }
    if (!events.length) return
    try {
      const result = await api.events(events)
      if (result.accepted > 0) {
        get().showToast(`从短信和通知里发现 ${result.accepted} 条线索`)
        setTimeout(() => void get().refresh(), 600)
      }
    } catch {
      // 下次启动再补
    }
  },

  ingestScreenshot: async () => {
    const shot = await pickImage()
    if (!shot || shot.kind !== 'image' || !shot.path) return
    const ocr = await recognizeImage(shot.path)
    if (!ocr?.text) {
      get().showToast('这张图里没有识别到文字')
      return
    }
    try {
      const result = await api.ocr(ocr.text)
      if (result.duty) {
        const duties = [...get().duties, result.duty]
        set({ duties, online: true })
        set({ stats: computeStats(duties, get().collections, get().stats) })
        get().showToast('识别到一件事，已加入待确认')
        return
      }
    } catch {
      // 云端不可用时退回收藏
    }
    await get().addCollection({
      title: firstLine(ocr.text).slice(0, 60),
      type: 'image',
      source: '截图',
      excerpt: ocr.text.slice(0, 240),
      imagePath: shot.path,
      meta: '图片 · 截图',
    })
    get().showToast('截图已收进收藏')
  },
}))

/* ---------------- 离线对话兜底 ---------------- */

function localChatFallback(text: string): {
  reply: string
  createDuty?: { title: string; type: string; date: string; timeLabel: string }
} {
  if (/这周|本周|漏了|回顾/.test(text)) {
    return { reply: '现在连不上云端。等联网后，我帮你把这周漏掉的事一次翻出来。' }
  }
  const action = /提醒|记得|别忘|要|看看|约|订|买|准备/.test(text)
  if (!action) {
    return { reply: '我在。现在处于离线演示模式，连上云端后就能真正记事和提醒了。' }
  }
  const tomorrow = /明天/.test(text)
  const date = tomorrow ? addDaysISO(1) : todayISO()
  const timeMatch = text.match(/(\d{1,2})\s*[点:：]\s*(\d{2})?/)
  const hour = timeMatch ? Number(timeMatch[1]) : 10
  const minute = timeMatch?.[2] ? timeMatch[2] : '00'
  const timeLabel = `${tomorrow ? '明天' : '今天'} ${String(hour).padStart(2, '0')}:${minute}`
  const title = text
    .replace(/^(帮我|请|你)?\s*(记得|提醒我|提醒|别忘了)/, '')
    .replace(/[。！!？?，,]$/g, '')
    .replace(/(明天|今天|上午|下午|晚上|今晚)/g, '')
    .replace(/\d{1,2}\s*[点:：]\s*\d{0,2}/g, '')
    .trim()
    .slice(0, 20) || '新待办'
  return {
    reply: `记下了。${timeLabel} 提醒你：${title}。（离线演示，联网后会同步到云端）`,
    createDuty: { title, type: '约定', date, timeLabel },
  }
}

export function selectTodayDuties(state: AppState): Duty[] {
  return state.duties.filter((d) => d.date === todayISO() && d.status !== 'dropped')
}
