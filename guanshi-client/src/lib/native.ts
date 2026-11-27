import {
  DeviceEventEmitter,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native'
import type { SharePayload } from './types'

interface RawShare {
  kind?: string
  text?: string | null
  path?: string | null
  mimeType?: string | null
  receivedAt?: number
}

interface ShareNative {
  getPendingShare(): Promise<RawShare | null>
  clearPendingShare(): void
  pickImage(): Promise<RawShare | null>
  readClipboard(): Promise<string | null>
  writeClipboard(text: string): Promise<boolean>
  openApp(packageName: string): Promise<boolean>
  addListener(eventName: string): void
  removeListeners(count: number): void
}

interface OcrNative {
  recognizeText(path: string): Promise<{ text: string; lines: string[] }>
}

interface AsrNative {
  isAvailable(): Promise<boolean>
  start(): Promise<string | null>
  startCloud(appId: string, apiKey: string, apiSecret: string): Promise<string | null>
  stop(): void
  cancel(): void
  addListener(eventName: string): void
  removeListeners(count: number): void
}

export interface SmsItem {
  address: string
  body: string
  date: number
}

interface SmsNative {
  getSince(since: number): Promise<SmsItem[]>
  hasPermission(): Promise<boolean>
  lastSeen(): Promise<number>
  markSeen(ts: number): void
  addListener(eventName: string): void
  removeListeners(count: number): void
}

export interface NotifyItem {
  packageName: string
  title: string
  text: string
  time: number
}

interface NotifyNative {
  drain(): Promise<NotifyItem[]>
  isEnabled(): Promise<boolean>
  openSettings(): void
  addListener(eventName: string): void
  removeListeners(count: number): void
}

export interface SpeechPartial {
  text: string
  final?: boolean
  error?: boolean
  code?: string
  message?: string
}

interface CryptoNative {
  encrypt(publicKeyPem: string, plaintext: string): Promise<string>
}

const SHARE_EVENT = 'GuanshiShareReceived'
const SPEECH_EVENT = 'GuanshiSpeechPartial'
const SMS_EVENT = 'GuanshiSmsReceived'
const NOTIFY_EVENT = 'GuanshiNotificationPosted'

function mod<T>(name: string): T | null {
  if (Platform.OS !== 'android') return null
  return ((NativeModules as Record<string, unknown>)[name] as T | undefined) ?? null
}

export function isOcrSupported(): boolean {
  return mod<OcrNative>('GuanshiOcr') != null
}

export function isSpeechSupported(): boolean {
  return mod<AsrNative>('GuanshiAsr') != null
}

export function isShareSupported(): boolean {
  return mod<ShareNative>('GuanshiShare') != null
}

/* ---------------- 华为推送 token ---------------- */

interface PushNative {
  getToken(): Promise<string>
  deleteToken(): Promise<boolean>
}

/** 拿不到（模拟器没 HMS Core、没放 agconnect-services.json）时返回 null，静默降级到前台通道 */
export async function getHuaweiPushToken(): Promise<string | null> {
  const module = mod<PushNative>('GuanshiPush')
  if (!module) return null
  try {
    const token = await module.getToken()
    return token || null
  } catch (error) {
    console.warn('[push] 获取华为 token 失败', error)
    return null
  }
}

/* ---------------- 模型 Key 加密 ---------------- */

/** 用服务端公钥做 RSA-OAEP(SHA-256) 加密，网络上只出现密文 */
export async function encryptSecret(publicKeyPem: string, plaintext: string): Promise<string> {
  const module = mod<CryptoNative>('GuanshiCrypto')
  if (!module) throw new Error('当前环境不支持加密传输，请使用 Android 真机或模拟器')
  return module.encrypt(publicKeyPem, plaintext)
}

/* ---------------- 分享进入 ---------------- */

function toShare(raw: RawShare | null | undefined): SharePayload | null {
  if (!raw) return null
  const kind = raw.kind === 'image' ? 'image' : raw.kind === 'text' ? 'text' : null
  if (!kind) return null
  const receivedAt = typeof raw.receivedAt === 'number' ? raw.receivedAt : Date.now()
  const text = raw.text?.trim() || undefined
  const path = raw.path || undefined
  if (kind === 'image' && !path) return null
  if (kind === 'text' && !text) return null
  return { id: `${receivedAt}:${path ?? text?.slice(0, 20)}`, kind, text, path, mimeType: raw.mimeType ?? undefined, receivedAt }
}

export async function getPendingShare(): Promise<SharePayload | null> {
  try {
    return toShare(await mod<ShareNative>('GuanshiShare')?.getPendingShare())
  } catch {
    return null
  }
}

export function clearPendingShare(): void {
  try {
    mod<ShareNative>('GuanshiShare')?.clearPendingShare()
  } catch {
    // ignore
  }
}

export function onShareReceived(callback: (payload: SharePayload) => void): () => void {
  const sub = DeviceEventEmitter.addListener(SHARE_EVENT, (raw: RawShare) => {
    const payload = toShare(raw)
    if (payload) callback(payload)
  })
  return () => sub.remove()
}

export async function pickImage(): Promise<SharePayload | null> {
  try {
    return toShare(await mod<ShareNative>('GuanshiShare')?.pickImage())
  } catch {
    return null
  }
}

/** 读剪贴板文本；微信文章只能复制链接过来，靠这个补分享入口 */
export async function readClipboardText(): Promise<string> {
  try {
    return (await mod<ShareNative>('GuanshiShare')?.readClipboard()) ?? ''
  } catch {
    return ''
  }
}

/** 写剪贴板：把原始分享文案复制回去，用户到对应 App 里粘贴 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    return Boolean(await mod<ShareNative>('GuanshiShare')?.writeClipboard(text))
  } catch {
    return false
  }
}

/** 按包名启动 App；没安装返回 false */
export async function openAppByPackage(packageName: string): Promise<boolean> {
  try {
    return Boolean(await mod<ShareNative>('GuanshiShare')?.openApp(packageName))
  } catch {
    return false
  }
}

export function inferSource(text: string, url = ''): string {
  const value = `${text} ${url}`.toLowerCase()
  if (value.includes('douyin') || value.includes('v.douyin') || value.includes('抖音')) return '抖音'
  if (value.includes('weixin') || value.includes('mp.weixin') || value.includes('微信')) return '微信'
  if (value.includes('xhslink') || value.includes('xiaohongshu') || value.includes('小红书')) return '小红书'
  return '网页'
}

/* ---------------- OCR ---------------- */

export async function recognizeImage(path: string): Promise<{ text: string; lines: string[] } | null> {
  try {
    const result = await mod<OcrNative>('GuanshiOcr')?.recognizeText(path)
    const text = (result?.text || '').trim()
    if (!text) return null
    return { text, lines: Array.isArray(result?.lines) ? result.lines : [] }
  } catch {
    return null
  }
}

/* ---------------- 语音 ---------------- */

export async function isSpeechAvailable(): Promise<boolean> {
  try {
    return Boolean(await mod<AsrNative>('GuanshiAsr')?.isAvailable())
  } catch {
    return false
  }
}

export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  try {
    if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)) return true
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: '需要麦克风权限',
      message: '语音只说一句话，转成文字后上传；录音不上传、不保存。',
      buttonPositive: '允许',
      buttonNegative: '取消',
    })
    return result === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

export async function startCloudSpeech(credentials: {
  appId: string
  apiKey: string
  apiSecret: string
}): Promise<string> {
  const module = mod<AsrNative>('GuanshiAsr')
  if (!module) throw new Error('设备不支持语音识别')
  const text = await module.startCloud(credentials.appId, credentials.apiKey, credentials.apiSecret)
  return (text || '').trim()
}

export async function startSystemSpeech(): Promise<string> {
  const module = mod<AsrNative>('GuanshiAsr')
  if (!module) throw new Error('设备不支持语音识别')
  const text = await module.start()
  return (text || '').trim()
}

export function stopSpeech(): void {
  try {
    mod<AsrNative>('GuanshiAsr')?.stop()
  } catch {
    // ignore
  }
}

export function cancelSpeech(): void {
  try {
    mod<AsrNative>('GuanshiAsr')?.cancel()
  } catch {
    // ignore
  }
}

export function onSpeechPartial(callback: (payload: SpeechPartial) => void): () => void {
  const sub = DeviceEventEmitter.addListener(SPEECH_EVENT, (raw: SpeechPartial) => {
    if (raw) callback({ ...raw, text: typeof raw.text === 'string' ? raw.text : '' })
  })
  return () => sub.remove()
}

/* ---------------- 短信 ---------------- */

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  try {
    if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)) return true
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
      title: '读取短信',
      message: '只在本机识别快递、取件码等事项，原文不上传，仅上传识别出的待办。',
      buttonPositive: '允许',
      buttonNegative: '不允许',
    })
    return result === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

export async function readSmsSince(since: number): Promise<SmsItem[]> {
  try {
    return (await mod<SmsNative>('GuanshiSms')?.getSince(since)) || []
  } catch {
    return []
  }
}

export async function smsLastSeen(): Promise<number> {
  try {
    return Number((await mod<SmsNative>('GuanshiSms')?.lastSeen()) || 0)
  } catch {
    return 0
  }
}

export function markSmsSeen(ts: number): void {
  try {
    mod<SmsNative>('GuanshiSms')?.markSeen(ts)
  } catch {
    // ignore
  }
}

export function onSmsReceived(callback: (item: SmsItem) => void): () => void {
  const sub = DeviceEventEmitter.addListener(SMS_EVENT, (item: SmsItem) => {
    if (item?.body) callback(item)
  })
  return () => sub.remove()
}

/* ---------------- 通知监听 ---------------- */

export async function drainNotifications(): Promise<NotifyItem[]> {
  try {
    return (await mod<NotifyNative>('GuanshiNotify')?.drain()) || []
  } catch {
    return []
  }
}

export async function isNotificationAccessEnabled(): Promise<boolean> {
  try {
    return Boolean(await mod<NotifyNative>('GuanshiNotify')?.isEnabled())
  } catch {
    return false
  }
}

export async function openNotificationSettings(): Promise<void> {
  try {
    mod<NotifyNative>('GuanshiNotify')?.openSettings()
  } catch {
    await Linking.openSettings()
  }
}

export function onNotificationPosted(callback: (item: NotifyItem) => void): () => void {
  const sub = DeviceEventEmitter.addListener(NOTIFY_EVENT, (item: NotifyItem) => {
    if (item?.text) callback(item)
  })
  return () => sub.remove()
}

/* ---------------- 推送通知权限 ---------------- */

/** 除晨报外都走这个渠道；渠道本身带声音，是否响铃由前台 handler 决定 */
export const REMINDER_CHANNEL = 'guanshi-reminders'

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  try {
    const permission = 'android.permission.POST_NOTIFICATIONS' as Parameters<
      typeof PermissionsAndroid.request
    >[0]
    if (Number(Platform.Version) < 33) return true
    if (await PermissionsAndroid.check(permission)) return true
    const result = await PermissionsAndroid.request(permission)
    return result === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}
