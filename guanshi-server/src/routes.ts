import { Router, type NextFunction, type Request, type Response } from 'express'
import { chat, extractFromText } from './agent'
import type { LlmConfig } from './agent'
import { decryptSecret, keyFingerprint, publicKeyPem } from './crypto'
import {
  addMessage,
  addMemory,
  clearMessages,
  createCollection,
  createDuty,
  deleteCollection,
  deleteMemory,
  ensureUser,
  getDuty,
  getStats,
  getUser,
  listCollections,
  listDuties,
  listFamily,
  listMemories,
  listMessages,
  markMessagesRead,
  registerPushToken,
  saveEvent,
  unreadCount,
  updateCollection,
  updateDuty,
  updateUserSettings,
} from './repos'
import { handleEvent, sendBriefing, sendReview } from './services'
import { calendarFestivals } from './holidays'
import { armByTimeLabel } from './reminders'
import { localDate, newId } from './util'
import type { DutyStatus } from './types'

type AuthedRequest = Request & { userId: string }

const router = Router()

/** 客户端传来的模型配置：Key 是 RSA 密文，只在本进程内存里解密，不落库 */
function readLlmConfig(raw: unknown): LlmConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as { baseUrl?: string; model?: string; apiKeyEnc?: string }
  const apiKeyEnc = String(input.apiKeyEnc || '').trim()
  if (!apiKeyEnc) return null
  const apiKey = decryptSecret(apiKeyEnc)
  if (!apiKey) return null
  const baseUrl = normalizeBaseUrl(String(input.baseUrl || ''))
  if (!baseUrl) return null
  return {
    baseUrl,
    model: String(input.model || '').trim() || 'deepseek-v4-flash',
    apiKey,
  }
}

function normalizeBaseUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(clean)) return ''
  return clean.replace(/\/chat\/completions$/i, '')
}

function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.header('x-user-id') || ''
  if (!token) {
    res.status(401).json({ error: '未登录' })
    return
  }
  const user = getUser(token)
  if (!user) {
    res.status(401).json({ error: '登录已失效，请重新进入应用' })
    return
  }
  ;(req as AuthedRequest).userId = user.id
  next()
}

function wrap(fn: (req: AuthedRequest, res: Response) => Promise<unknown> | unknown) {
  return (req: Request, res: Response) => {
    Promise.resolve(fn(req as AuthedRequest, res)).catch((error: Error) => {
      console.warn('[api]', error)
      res.status(500).json({ error: error.message || '服务异常' })
    })
  }
}

/* ---------------- 登录 ---------------- */

router.post(
  '/auth/login',
  wrap((req, res) => {
    const deviceId = String(req.body?.deviceId || '').trim() || `device-${newId('d')}`
    const name = typeof req.body?.name === 'string' ? req.body.name : undefined
    const user = ensureUser(deviceId, name)
    res.json({ token: user.id, user })
  }),
)

/* ---------------- 启动数据 ---------------- */

router.get(
  '/bootstrap',
  auth,
  wrap((req, res) => {
    const user = getUser(req.userId)!
    res.json({
      user,
      stats: getStats(req.userId),
      duties: listDuties(req.userId),
      messages: listMessages(req.userId),
      collections: listCollections(req.userId),
      memories: listMemories(req.userId),
      family: listFamily(req.userId),
      unread: unreadCount(req.userId),
      today: localDate(),
      festivals: calendarFestivals(),
    })
  }),
)

/* ---------------- 待办 ---------------- */

router.get(
  '/duties',
  auth,
  wrap((req, res) => {
    res.json({ duties: listDuties(req.userId) })
  }),
)

router.post(
  '/duties',
  auth,
  wrap((req, res) => {
    const title = String(req.body?.title || '').trim()
    if (!title) {
      res.status(400).json({ error: '标题不能为空' })
      return
    }
    const duty = createDuty(req.userId, {
      title,
      type: req.body?.type || '其他',
      source: req.body?.source || '手动',
      status: (req.body?.status as DutyStatus) || 'open',
      date: req.body?.date || localDate(),
      timeLabel: req.body?.timeLabel || '今天',
      quote: req.body?.quote || '',
      rule: req.body?.rule || '到点提醒一次',
    })
    armByTimeLabel(req.userId, duty)
    res.status(201).json({ duty })
  }),
)

router.patch(
  '/duties/:id',
  auth,
  wrap((req, res) => {
    const patch: Record<string, unknown> = {}
    for (const key of ['title', 'type', 'source', 'status', 'date', 'timeLabel', 'quote', 'rule']) {
      if (req.body?.[key] !== undefined) patch[key] = req.body[key]
    }
    const duty = updateDuty(req.userId, req.params.id, patch)
    if (!duty) {
      res.status(404).json({ error: '待办不存在' })
      return
    }
    res.json({ duty })
  }),
)

router.post(
  '/duties/:id/complete',
  auth,
  wrap((req, res) => {
    const duty = updateDuty(req.userId, req.params.id, { status: 'done' })
    if (!duty) {
      res.status(404).json({ error: '待办不存在' })
      return
    }
    res.json({ duty })
  }),
)

router.post(
  '/duties/:id/snooze',
  auth,
  wrap((req, res) => {
    const duty = getDuty(req.userId, req.params.id)
    if (!duty) {
      res.status(404).json({ error: '待办不存在' })
      return
    }
    const next = new Date(Date.parse(`${duty.date}T00:00:00+08:00`) + 86400_000)
    const date = next.toISOString().slice(0, 10)
    const updated = updateDuty(req.userId, duty.id, { status: 'open', date, timeLabel: '明天' })
    res.json({ duty: updated })
  }),
)

router.delete(
  '/duties/:id',
  auth,
  wrap((req, res) => {
    const duty = updateDuty(req.userId, req.params.id, { status: 'dropped' })
    if (!duty) {
      res.status(404).json({ error: '待办不存在' })
      return
    }
    res.json({ duty })
  }),
)

/* ---------------- 对话 ---------------- */

router.get(
  '/messages',
  auth,
  wrap((req, res) => {
    res.json({ messages: listMessages(req.userId) })
  }),
)

router.post(
  '/messages/read',
  auth,
  wrap((req, res) => {
    markMessagesRead(req.userId)
    res.json({ ok: true })
  }),
)

router.delete(
  '/messages',
  auth,
  wrap((req, res) => {
    clearMessages(req.userId)
    res.json({ ok: true })
  }),
)

router.post(
  '/chat',
  auth,
  wrap(async (req, res) => {
    const text = String(req.body?.text || '').trim()
    if (!text) {
      res.status(400).json({ error: '说点什么吧' })
      return
    }
    const llm = readLlmConfig(req.body?.llm)
    if (req.body?.llm && !llm) {
      res.status(400).json({ error: '模型密钥解密失败，请在设置里重新保存' })
      return
    }
    const history = listMessages(req.userId)
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }))
    const result = await chat(req.userId, text, history, llm)
    const mine = addMessage(req.userId, 'me', text)
    const reply = addMessage(req.userId, 'ai', result.reply, {
      kind: result.created.length ? 'duty' : null,
      dutyId: result.created[0]?.id ?? null,
    })
    res.json({
      reply: result.reply,
      messages: [mine, reply],
      duties: result.created,
      updated: result.updated,
      memories: result.memories,
      usedModel: result.usedModel,
    })
  }),
)

/* ---------------- 收藏 ---------------- */

router.get(
  '/collections',
  auth,
  wrap((req, res) => {
    res.json({ collections: listCollections(req.userId) })
  }),
)

router.post(
  '/collections',
  auth,
  wrap((req, res) => {
    const title = String(req.body?.title || '').trim()
    if (!title) {
      res.status(400).json({ error: '缺少标题' })
      return
    }
    const collection = createCollection(req.userId, {
      title,
      type: req.body?.type || 'link',
      source: req.body?.source || '网页',
      excerpt: req.body?.excerpt || '',
      url: req.body?.url || '',
      note: req.body?.note || '',
      imagePath: req.body?.imagePath || null,
      meta: req.body?.meta || '分享',
      clip: typeof req.body?.clip === 'string' ? req.body.clip.slice(0, 2000) : '',
    })
    res.status(201).json({ collection })
  }),
)

router.patch(
  '/collections/:id',
  auth,
  wrap((req, res) => {
    const collection = updateCollection(req.userId, req.params.id, {
      status: req.body?.status,
      note: req.body?.note,
      title: req.body?.title,
      excerpt: req.body?.excerpt,
    })
    if (!collection) {
      res.status(404).json({ error: '收藏不存在' })
      return
    }
    res.json({ collection })
  }),
)

router.delete(
  '/collections/:id',
  auth,
  wrap((req, res) => {
    deleteCollection(req.userId, req.params.id)
    res.json({ ok: true })
  }),
)

/* ---------------- 记忆 ---------------- */

router.get(
  '/memories',
  auth,
  wrap((req, res) => {
    res.json({ memories: listMemories(req.userId) })
  }),
)

router.post(
  '/memories',
  auth,
  wrap((req, res) => {
    const text = String(req.body?.text || '').trim()
    if (!text) {
      res.status(400).json({ error: '内容不能为空' })
      return
    }
    const memory = addMemory(req.userId, String(req.body?.kind || '事实'), text)
    res.status(201).json({ memory })
  }),
)

router.delete(
  '/memories/:id',
  auth,
  wrap((req, res) => {
    deleteMemory(req.userId, req.params.id)
    res.json({ ok: true })
  }),
)

router.get(
  '/family',
  auth,
  wrap((req, res) => {
    res.json({ family: listFamily(req.userId) })
  }),
)

/* ---------------- 事件上报（短信 / 通知 / 语音） ---------------- */

router.post(
  '/events',
  auth,
  wrap((req, res) => {
    const events = Array.isArray(req.body?.events) ? req.body.events : [req.body]
    let accepted = 0
    for (const raw of events.slice(0, 30)) {
      const uid = String(raw?.uid || newId('e'))
      const kind = String(raw?.kind || 'other')
      const payload = raw?.payload || {}
      if (!saveEvent(req.userId, uid, kind, payload)) continue
      accepted += 1
      handleEvent(req.userId, kind, payload)
    }
    res.json({ accepted })
  }),
)

/** 端侧 OCR 文本落库为待办：端侧只传文字，不传图 */
router.post(
  '/ocr',
  auth,
  wrap((req, res) => {
    const text = String(req.body?.text || '').trim()
    if (!text) {
      res.status(400).json({ error: '没有识别到文字' })
      return
    }
    const extracted = extractFromText(text)
    if (!extracted) {
      res.json({ duty: null, text })
      return
    }
    const duty = createDuty(req.userId, {
      ...extracted,
      source: '截图',
      status: 'pending',
      date: extracted.date || localDate(),
      origin: `截图 OCR · ${localDate()} · 待确认`,
      sort: 1800,
    })
    armByTimeLabel(req.userId, duty)
    res.status(201).json({ duty, text })
  }),
)

/* ---------------- 推送与设置 ---------------- */

router.post(
  '/push-token',
  auth,
  wrap((req, res) => {
    const token = String(req.body?.token || '').trim()
    if (!token) {
      res.status(400).json({ error: '缺少 token' })
      return
    }
    registerPushToken(req.userId, token, String(req.body?.platform || 'android'))
    res.json({ ok: true })
  }),
)

router.patch(
  '/me/settings',
  auth,
  wrap((req, res) => {
    const user = updateUserSettings(req.userId, {
      name: req.body?.name,
      briefingTime: req.body?.briefingTime,
      reviewTime: req.body?.reviewTime,
      quietStart: req.body?.quietStart,
      quietEnd: req.body?.quietEnd,
      reminderStyle: req.body?.reminderStyle,
    })
    res.json({ user })
  }),
)

router.post(
  '/push/test',
  auth,
  wrap((req, res) => {
    const kind = String(req.body?.kind || 'briefing')
    if (kind === 'briefing') {
      res.json({ ok: true, ...sendBriefing(req.userId) })
    } else if (kind === 'review') {
      res.json({ ok: true, ...sendReview(req.userId) })
    } else {
      res.status(400).json({ error: '只支持 briefing / review' })
    }
  }),
)

/** 用客户端上送的 Key 拉取可用模型，方便用户不用记模型名 */
router.post(
  '/llm/models',
  auth,
  wrap(async (req, res) => {
    const llm = readLlmConfig(req.body?.llm)
    if (!llm) {
      res.status(400).json({ error: '模型密钥解密失败，请重新保存 Key' })
      return
    }
    const response = await fetch(`${llm.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${llm.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      res.status(response.status === 401 ? 401 : 502).json({
        error: response.status === 401 ? 'API Key 无效' : `模型服务返回 ${response.status}`,
      })
      return
    }
    const data = (await response.json()) as { data?: { id?: string }[]; models?: { name?: string }[] }
    const models = [
      ...(data.data || []).map((item) => item.id),
      ...(data.models || []).map((item) => item.name),
    ].filter((id): id is string => Boolean(id))
    res.json({ models })
  }),
)

/* ---------------- 健康检查 / 传输密钥 ---------------- */

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'guanshi-server', time: new Date().toISOString() })
})

/** 公钥用于客户端加密模型 Key，无需登录 */
router.get('/crypto/public-key', (_req, res) => {
  res.json({ publicKey: publicKeyPem, fingerprint: keyFingerprint, algorithm: 'RSA-OAEP-SHA256' })
})

export default router
