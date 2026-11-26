import type { Server } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { db } from './db'

/**
 * 前台推送通道（过渡方案）。
 * App 在前台时保持一条 WebSocket 长连接，服务端一有新消息就即时下发，
 * 客户端据此弹本地通知并刷新数据。App 被杀后这条连接不存在，
 * 仍需厂商通道（deliver 里的 TODO）才能真正「杀 App 也能提醒」。
 */

interface Client {
  socket: WebSocket
  userId: string
  alive: boolean
}

export interface StreamPayload {
  type: 'message'
  title: string
  body: string
  messageId?: string
  dutyId?: string
  kind?: string
}

const clients = new Set<Client>()
let heartbeat: ReturnType<typeof setInterval> | null = null

function userExists(token: string): string | null {
  if (!token) return null
  const row = db.prepare('SELECT id FROM users WHERE id = ?').get(token) as { id: string } | undefined
  return row?.id ?? null
}

export function attachStream(server: Server): void {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname !== '/api/stream') {
      socket.destroy()
      return
    }
    const userId = userExists(url.searchParams.get('token') || '')
    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const client: Client = { socket: ws, userId, alive: true }
      clients.add(client)
      console.log(`[stream] ${userId} 接入，在线 ${clients.size}`)
      ws.on('pong', () => {
        client.alive = true
      })
      ws.on('message', (raw) => {
        if (String(raw) === 'ping') ws.send('pong')
      })
      ws.on('close', () => {
        clients.delete(client)
        console.log(`[stream] ${userId} 断开，在线 ${clients.size}`)
      })
      ws.on('error', () => {
        clients.delete(client)
      })
    })
  })

  heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.socket.terminate()
        clients.delete(client)
        continue
      }
      client.alive = false
      client.socket.ping()
    }
  }, 30_000)
  heartbeat.unref()
}

/** 给某个用户的所有在线连接推一条消息，返回是否送达 */
export function pushToUser(userId: string, payload: StreamPayload): boolean {
  const text = JSON.stringify(payload)
  let sent = false
  for (const client of clients) {
    if (client.userId !== userId) continue
    if (client.socket.readyState !== WebSocket.OPEN) continue
    client.socket.send(text)
    sent = true
  }
  return sent
}

export function stopStream(): void {
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  for (const client of clients) client.socket.terminate()
  clients.clear()
}
