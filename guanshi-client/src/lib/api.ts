import { Platform } from 'react-native'
import { encryptSecret } from './native'
import type {
  Bootstrap,
  Collection,
  Duty,
  DutyStatus,
  Family,
  Memory,
  Message,
  User,
} from './types'

export const DEFAULT_API_BASE =
  Platform.OS === 'android' ? 'http://10.0.2.2:8787/api' : 'http://localhost:8787/api'

let base = DEFAULT_API_BASE
let token: string | null = null

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

export function setApiBase(next: string): void {
  const clean = next.trim().replace(/\/+$/, '')
  base = clean.endsWith('/api') ? clean : `${clean}/api`
  publicKeyCache = null
  token = null
}

export function getApiBase(): string {
  return base
}

export function setToken(next: string | null): void {
  token = next
}

/* ---------------- 传输加密 ---------------- */

export interface LlmSettings {
  baseUrl: string
  model: string
  apiKey: string
}

let publicKeyCache: { pem: string; fingerprint: string } | null = null

export async function getServerPublicKey(force = false): Promise<{ pem: string; fingerprint: string }> {
  if (publicKeyCache && !force) return publicKeyCache
  const data = await request<{ publicKey: string; fingerprint: string }>('/crypto/public-key')
  publicKeyCache = { pem: data.publicKey, fingerprint: data.fingerprint }
  return publicKeyCache
}

export function clearPublicKeyCache(): void {
  publicKeyCache = null
}

async function request<T>(path: string, init: RequestInit = {}, timeout = 20_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    })
    const text = await response.text()
    const data = text ? JSON.parse(text) : {}
    if (!response.ok) {
      throw new ApiError(data.error || `请求失败（${response.status}）`, response.status)
    }
    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if ((error as Error).name === 'AbortError') throw new ApiError('连接超时，请检查服务端地址', 0)
    throw new ApiError((error as Error).message || '网络不可用', 0)
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  login: (deviceId: string, name?: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ deviceId, name }),
    }),

  bootstrap: () => request<Bootstrap>('/bootstrap'),

  health: () => request<{ ok: boolean; service: string }>('/health'),

  chat: async (text: string, llm?: LlmSettings | null) => {
    let encrypted: Record<string, string> | undefined
    if (llm?.apiKey) {
      const key = await getServerPublicKey()
      const apiKeyEnc = await encryptSecret(key.pem, llm.apiKey)
      encrypted = {
        baseUrl: llm.baseUrl,
        model: llm.model || 'deepseek-v4-flash',
        apiKeyEnc,
      }
    }
    return request<{
      reply: string
      messages: Message[]
      duties: Duty[]
      updated: Duty[]
      memories: Memory[]
      usedModel: boolean
    }>(
      '/chat',
      { method: 'POST', body: JSON.stringify({ text, llm: encrypted }) },
      45_000,
    )
  },

  listModels: async (llm: LlmSettings) => {
    if (!llm.apiKey) throw new ApiError('先填 API Key', 0)
    const key = await getServerPublicKey()
    const apiKeyEnc = await encryptSecret(key.pem, llm.apiKey)
    return request<{ models: string[] }>(
      '/llm/models',
      {
        method: 'POST',
        body: JSON.stringify({ llm: { baseUrl: llm.baseUrl, model: llm.model, apiKeyEnc } }),
      },
      25_000,
    )
  },

  createDuty: (input: Partial<Duty> & { title: string }) =>
    request<{ duty: Duty }>('/duties', { method: 'POST', body: JSON.stringify(input) }),

  patchDuty: (id: string, patch: Record<string, unknown>) =>
    request<{ duty: Duty }>(`/duties/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  completeDuty: (id: string) => request<{ duty: Duty }>(`/duties/${id}/complete`, { method: 'POST' }),

  snoozeDuty: (id: string) => request<{ duty: Duty }>(`/duties/${id}/snooze`, { method: 'POST' }),

  dropDuty: (id: string) => request<{ duty: Duty }>(`/duties/${id}`, { method: 'DELETE' }),

  createCollection: (input: Partial<Collection> & { title: string }) =>
    request<{ collection: Collection }>('/collections', { method: 'POST', body: JSON.stringify(input) }),

  updateCollection: (id: string, patch: Record<string, unknown>) =>
    request<{ collection: Collection }>(`/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteCollection: (id: string) => request<{ ok: boolean }>(`/collections/${id}`, { method: 'DELETE' }),

  addMemory: (kind: string, text: string) =>
    request<{ memory: Memory }>('/memories', { method: 'POST', body: JSON.stringify({ kind, text }) }),

  deleteMemory: (id: string) => request<{ ok: boolean }>(`/memories/${id}`, { method: 'DELETE' }),

  family: () => request<{ family: Family[] }>('/family'),

  events: (events: { uid: string; kind: string; payload: Record<string, unknown> }[]) =>
    request<{ accepted: number }>('/events', { method: 'POST', body: JSON.stringify({ events }) }),

  ocr: (text: string) =>
    request<{ duty: Duty | null; text: string }>('/ocr', { method: 'POST', body: JSON.stringify({ text }) }),

  saveSettings: (patch: Record<string, unknown>) =>
    request<{ user: User }>('/me/settings', { method: 'PATCH', body: JSON.stringify(patch) }),

  testPush: (kind: 'briefing' | 'review' = 'briefing') =>
    request<{ ok: boolean; title: string; messageId: string }>('/push/test', {
      method: 'POST',
      body: JSON.stringify({ kind }),
    }),

  markRead: () => request<{ ok: boolean }>('/messages/read', { method: 'POST' }),

  clearMessages: () => request<{ ok: boolean }>('/messages', { method: 'DELETE' }),

  statusOf: (duty: Duty): DutyStatus => duty.status,
}
