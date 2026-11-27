import { config } from './config'

/**
 * 华为推送（HMS Push）服务端通道。
 * 走「通知消息」而不是「透传消息」：消息由系统通知中心展示，
 * 应用被杀死也能收到，点通知通过 intent 直接回到对应消息。
 */

const OAUTH_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token'
const SEND_URL = 'https://push-api.cloud.huawei.com/v1'

/** 与 app.json 的 scheme、applicationId 保持一致 */
const DEEP_LINK_SCHEME = 'guanshi'
const APP_PACKAGE = 'com.guanshi.app'

interface CachedToken {
  value: string
  expiresAt: number
}

let cached: CachedToken | null = null

export function huaweiConfigured(): boolean {
  return Boolean(config.huawei.clientId && config.huawei.clientSecret)
}

async function accessToken(force = false): Promise<string> {
  if (!force && cached && cached.expiresAt - 60_000 > Date.now()) return cached.value
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.huawei.clientId,
    client_secret: config.huawei.clientSecret,
  })
  const response = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  })
  const json = (await response.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: number | string
    error_description?: string
  }
  if (!json.access_token) {
    throw new Error(`华为鉴权失败：${json.error ?? response.status} ${json.error_description ?? ''}`.trim())
  }
  cached = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return cached.value
}

export interface HuaweiMessage {
  title: string
  body: string
  /** 点通知后回到的消息 id */
  messageId?: string
}

export interface HuaweiSendResult {
  ok: boolean
  /** 该 token 已失效，应从 push_tokens 里删掉 */
  invalidToken: boolean
  code?: string
  message?: string
}

function clickIntent(messageId?: string): string {
  const path = messageId ? `/chat?messageId=${encodeURIComponent(messageId)}` : '/chat'
  return `intent://${APP_PACKAGE}${path}#Intent;scheme=${DEEP_LINK_SCHEME};launchFlags=0x10000000;end`
}

function buildPayload(pushToken: string, message: HuaweiMessage): Record<string, unknown> {
  const android: Record<string, unknown> = {
    ttl: '86400s',
    notification: {
      title: message.title,
      body: message.body,
      importance: 'NORMAL',
      click_action: { type: 1, intent: clickIntent(message.messageId) },
    },
  }
  // 自分类权益通过后 category=WORK 才是「锁屏+铃声+振动」，未通过时带上也会被归为资讯营销
  if (config.huawei.category) android.category = config.huawei.category
  // 调测阶段用测试消息，豁免每日单设备 2 条的资讯营销频控
  if (config.huawei.testMessage) android.target_user_type = 1

  return {
    validate_only: false,
    message: {
      token: [pushToken],
      notification: { title: message.title, body: message.body },
      android,
    },
  }
}

export async function sendHuaweiPush(pushToken: string, message: HuaweiMessage): Promise<HuaweiSendResult> {
  if (!huaweiConfigured()) return { ok: false, invalidToken: false, message: '未配置华为推送凭据' }
  const payload = JSON.stringify(buildPayload(pushToken, message))
  let last: HuaweiSendResult = { ok: false, invalidToken: false, message: '未知错误' }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let auth: string
    try {
      auth = await accessToken(attempt > 0)
    } catch (error) {
      return { ok: false, invalidToken: false, message: (error as Error).message }
    }
    try {
      const response = await fetch(`${SEND_URL}/${config.huawei.clientId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json;charset=utf-8' },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      })
      const json = (await response.json().catch(() => ({}))) as { code?: string; msg?: string }
      if (json.code === '80000000') return { ok: true, invalidToken: false }
      last = {
        ok: false,
        invalidToken: json.code === '80300007',
        code: json.code ?? String(response.status),
        message: json.msg,
      }
      // 鉴权失效时强制换一次 token 再试
      if (json.code === '80200001' && attempt === 0) continue
      return last
    } catch (error) {
      last = { ok: false, invalidToken: false, message: (error as Error).message }
    }
  }
  return last
}
