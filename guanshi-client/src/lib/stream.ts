import { getApiBase } from './api'

/**
 * 前台推送通道（过渡方案）。
 * App 在前台时保持一条 WebSocket，服务端新增消息即下发，
 * 客户端弹本地通知并刷新数据。App 被杀后连接不存在，
 * 真正的离线推送仍要接厂商通道。
 */

export interface StreamMessage {
  type: 'message'
  title: string
  body: string
  messageId?: string
  dutyId?: string
  kind?: string
}

type Handler = (message: StreamMessage) => void

let socket: WebSocket | null = null
let handler: Handler | null = null
let token: string | null = null
let retries = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let stopped = true

function endpoint(): string {
  const base = getApiBase().replace(/^http/i, 'ws').replace(/\/+$/, '')
  return `${base}/stream?token=${encodeURIComponent(token || '')}`
}

function teardown(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  const old = socket
  socket = null
  if (old) {
    try {
      old.close()
    } catch {
      // ignore
    }
  }
}

function connect(): void {
  if (stopped || !token) return
  teardown()
  const ws = new WebSocket(endpoint())
  socket = ws
  ws.onopen = () => {
    retries = 0
  }
  ws.onmessage = (event) => {
    const raw = String(event.data ?? '')
    if (!raw || raw === 'pong') return
    try {
      const data = JSON.parse(raw) as StreamMessage
      if (data?.type === 'message') handler?.(data)
    } catch {
      // 忽略非法消息
    }
  }
  ws.onerror = () => {
    // 统一走 onclose 重连
  }
  ws.onclose = () => {
    socket = null
    if (stopped) return
    retries += 1
    const delay = Math.min(30_000, 2_000 * retries)
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = setTimeout(connect, delay)
  }
}

/** 幂等：token 不变就复用现有连接，变了或未连接才重建 */
export function ensureStream(nextToken: string, onMessage: Handler): void {
  handler = onMessage
  if (!stopped && token === nextToken) return
  stopped = false
  token = nextToken
  retries = 0
  connect()
}

export function stopStream(): void {
  stopped = true
  handler = null
  token = null
  teardown()
}

export function isStreamActive(): boolean {
  return !stopped
}
