import { db } from './db'
import { seedUser } from './seed'
import { pushToUser } from './stream'
import type { Collection, Duty, DutyStatus, Family, Memory, Message, User } from './types'
import { addDays, localDate, localTime, newId, now, parseJson } from './util'

type Row = Record<string, any>

/* ---------------- 用户 ---------------- */

function toUser(row: Row): User {
  return {
    id: row.id,
    deviceId: row.device_id,
    name: row.name,
    plan: row.plan,
    timezone: row.timezone,
    briefingTime: row.briefing_time,
    reviewTime: row.review_time,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    reminderStyle: row.reminder_style,
    createdAt: row.created_at,
  }
}

export function ensureUser(deviceId: string, name?: string): User {
  const existing = db.prepare('SELECT * FROM users WHERE device_id = ?').get(deviceId) as Row | undefined
  if (existing) return toUser(existing)
  const id = newId('u')
  db.prepare(`
    INSERT INTO users (id,device_id,name,plan,timezone,briefing_time,review_time,quiet_start,quiet_end,reminder_style,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, deviceId, name || '本机用户', '高级版', 'Asia/Shanghai', '07:30', '21:00', '22:00', '07:00', 'standard', now())
  seedUser(id)
  return getUser(id)!
}

export function getUser(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined
  return row ? toUser(row) : null
}

export function updateUserSettings(id: string, patch: Partial<{
  name: string
  briefingTime: string
  reviewTime: string
  quietStart: string
  quietEnd: string
  reminderStyle: 'quiet' | 'standard' | 'active'
}>): User | null {
  const current = getUser(id)
  if (!current) return null
  db.prepare(`
    UPDATE users SET name=?, briefing_time=?, review_time=?, quiet_start=?, quiet_end=?, reminder_style=?
    WHERE id=?
  `).run(
    patch.name ?? current.name,
    patch.briefingTime ?? current.briefingTime,
    patch.reviewTime ?? current.reviewTime,
    patch.quietStart ?? current.quietStart,
    patch.quietEnd ?? current.quietEnd,
    patch.reminderStyle ?? current.reminderStyle,
    id,
  )
  return getUser(id)
}

/* ---------------- 待办 ---------------- */

function toDuty(row: Row): Duty {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    type: row.type,
    source: row.source,
    status: row.status,
    confidence: row.confidence ?? undefined,
    date: row.date,
    timeLabel: row.time_label,
    sort: row.sort,
    origin: row.origin,
    quote: row.quote,
    rule: row.rule,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastNotifiedAt: row.last_notified_at ?? undefined,
    doneAt: row.done_at ?? undefined,
    history: parseJson(row.history, [] as { t: string; s: string }[]),
  }
}

export function listDuties(userId: string): Duty[] {
  const rows = db.prepare('SELECT * FROM duties WHERE user_id = ? ORDER BY date, sort, created_at').all(userId) as Row[]
  return rows.map(toDuty)
}

export function getDuty(userId: string, id: string): Duty | null {
  const row = db.prepare('SELECT * FROM duties WHERE user_id = ? AND id = ?').get(userId, id) as Row | undefined
  return row ? toDuty(row) : null
}

export interface DutyInput {
  title: string
  type?: string
  source?: string
  status?: DutyStatus
  confidence?: number
  date?: string
  timeLabel?: string
  sort?: number
  origin?: string
  quote?: string
  rule?: string
  history?: { t: string; s: string }[]
}

export function createDuty(userId: string, input: DutyInput): Duty {
  const id = newId('d')
  const ts = now()
  const date = input.date || localDate()
  db.prepare(`
    INSERT INTO duties (id,user_id,title,type,source,status,confidence,date,time_label,sort,origin,quote,rule,history,created_at,updated_at,done_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    userId,
    input.title,
    input.type || '其他',
    input.source || '手动',
    input.status || 'open',
    input.confidence ?? null,
    date,
    input.timeLabel || '今天',
    input.sort ?? 1200,
    input.origin || '手动创建',
    input.quote || '',
    input.rule || '到点提醒一次',
    JSON.stringify(input.history || [{ t: `今天 ${localTime(ts)}`, s: '创建待办' }]),
    ts,
    ts,
    null,
  )
  return getDuty(userId, id)!
}

export function updateDuty(
  userId: string,
  id: string,
  patch: Partial<DutyInput> & { status?: DutyStatus; lastNotifiedAt?: number; doneAt?: number },
): Duty | null {
  const current = getDuty(userId, id)
  if (!current) return null
  const ts = now()
  const doneAt =
    patch.status === 'done' ? (patch.doneAt ?? ts) : patch.status ? null : current.doneAt ?? null
  const history = patch.history
    ? patch.history
    : patch.status && patch.status !== current.status
      ? [...current.history, { t: `今天 ${localTime(ts)}`, s: statusLabel(patch.status) }].slice(-20)
      : current.history
  db.prepare(`
    UPDATE duties SET title=?, type=?, source=?, status=?, confidence=?, date=?, time_label=?, sort=?, origin=?, quote=?, rule=?, history=?, updated_at=?, last_notified_at=?, done_at=?
    WHERE user_id=? AND id=?
  `).run(
    patch.title ?? current.title,
    patch.type ?? current.type,
    patch.source ?? current.source,
    patch.status ?? current.status,
    patch.confidence ?? current.confidence ?? null,
    patch.date ?? current.date,
    patch.timeLabel ?? current.timeLabel,
    patch.sort ?? current.sort,
    patch.origin ?? current.origin,
    patch.quote ?? current.quote,
    patch.rule ?? current.rule,
    JSON.stringify(history),
    ts,
    patch.lastNotifiedAt ?? current.lastNotifiedAt ?? null,
    doneAt,
    userId,
    id,
  )
  return getDuty(userId, id)
}

function statusLabel(status: DutyStatus): string {
  return status === 'done' ? '标记完成' : status === 'dropped' ? '不再提醒' : status === 'pending' ? '等待确认' : '恢复待办'
}

/* ---------------- 消息 ---------------- */

function toMessage(row: Row): Message {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    text: row.text,
    kind: row.kind ?? null,
    dutyId: row.duty_id ?? null,
    createdAt: row.created_at,
    read: row.read,
  }
}

export function addMessage(
  userId: string,
  role: 'me' | 'ai',
  text: string,
  options: { kind?: string | null; dutyId?: string | null } = {},
): Message {
  const id = newId('m')
  db.prepare(
    'INSERT INTO messages (id,user_id,role,text,kind,duty_id,created_at,read) VALUES (?,?,?,?,?,?,?,?)',
  ).run(id, userId, role, text, options.kind ?? null, options.dutyId ?? null, now(), role === 'me' ? 1 : 0)
  return toMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Row)
}

export function listMessages(userId: string, limit = 100): Message[] {
  const rows = db
    .prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as Row[]
  return rows.reverse().map(toMessage)
}

export function markMessagesRead(userId: string): void {
  db.prepare('UPDATE messages SET read = 1 WHERE user_id = ?').run(userId)
}

export function unreadCount(userId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND read = 0').get(userId) as Row
  return row.n
}

export function clearMessages(userId: string): void {
  db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId)
}

/* ---------------- 收藏 ---------------- */

function toCollection(row: Row): Collection {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    source: row.source,
    status: row.status,
    title: row.title,
    excerpt: row.excerpt,
    url: row.url,
    note: row.note,
    imagePath: row.image_path,
    meta: row.meta,
    clip: row.clip || '',
    createdAt: row.created_at,
  }
}

export function listCollections(userId: string): Collection[] {
  const rows = db
    .prepare('SELECT * FROM collections WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Row[]
  return rows.map(toCollection)
}

export function getCollection(userId: string, id: string): Collection | null {
  const row = db.prepare('SELECT * FROM collections WHERE user_id = ? AND id = ?').get(userId, id) as Row | undefined
  return row ? toCollection(row) : null
}

export function createCollection(
  userId: string,
  input: Partial<Collection> & { title: string },
): Collection {
  const id = newId('c')
  db.prepare(`
    INSERT INTO collections (id,user_id,type,source,status,title,excerpt,url,note,image_path,meta,clip,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    userId,
    input.type || 'link',
    input.source || '网页',
    input.status || 'inbox',
    input.title,
    input.excerpt || '',
    input.url || '',
    input.note || '',
    input.imagePath || null,
    input.meta || '分享',
    input.clip || '',
    now(),
  )
  return getCollection(userId, id)!
}

export function updateCollection(userId: string, id: string, patch: Partial<Collection>): Collection | null {
  const current = getCollection(userId, id)
  if (!current) return null
  db.prepare('UPDATE collections SET status=?, note=?, title=?, excerpt=? WHERE user_id=? AND id=?').run(
    patch.status ?? current.status,
    patch.note ?? current.note,
    patch.title ?? current.title,
    patch.excerpt ?? current.excerpt,
    userId,
    id,
  )
  return getCollection(userId, id)
}

export function deleteCollection(userId: string, id: string): void {
  db.prepare('DELETE FROM collections WHERE user_id = ? AND id = ?').run(userId, id)
}

/* ---------------- 记忆 ---------------- */

function toMemory(row: Row): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    text: row.text,
    createdAt: row.created_at,
  }
}

export function listMemories(userId: string): Memory[] {
  const rows = db.prepare('SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Row[]
  return rows.map(toMemory)
}

export function addMemory(userId: string, kind: string, text: string): Memory {
  const id = newId('m')
  db.prepare('INSERT INTO memories (id,user_id,kind,text,created_at) VALUES (?,?,?,?,?)').run(
    id, userId, kind, text, now(),
  )
  return toMemory(db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as Row)
}

export function deleteMemory(userId: string, id: string): void {
  db.prepare('DELETE FROM memories WHERE user_id = ? AND id = ?').run(userId, id)
}

/* ---------------- 家人 ---------------- */

export function listFamily(userId: string): Family[] {
  const rows = db.prepare('SELECT * FROM family WHERE user_id = ?').all(userId) as Row[]
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    relation: row.relation,
    birthday: row.birthday,
    note: row.note,
  }))
}

/* ---------------- 定时器 ---------------- */

export function createTimer(
  userId: string,
  dueAt: number,
  options: { dutyId?: string; kind?: 'remind' | 'briefing' | 'review'; id?: string } = {},
): void {
  db.prepare(
    'INSERT OR IGNORE INTO timers (id,user_id,duty_id,kind,due_at,fired,created_at) VALUES (?,?,?,?,?,0,?)',
  ).run(
    options.id || newId('t'),
    userId,
    options.dutyId || null,
    options.kind || 'remind',
    dueAt,
    now(),
  )
}

export function dueTimers(ts: number): { id: string; user_id: string; duty_id: string | null; kind: string }[] {
  return db
    .prepare('SELECT id,user_id,duty_id,kind FROM timers WHERE fired = 0 AND due_at <= ? ORDER BY due_at LIMIT 50')
    .all(ts) as unknown as { id: string; user_id: string; duty_id: string | null; kind: string }[]
}

export function fireTimer(id: string): void {
  db.prepare('UPDATE timers SET fired = 1 WHERE id = ?').run(id)
}

/* ---------------- 事件 ---------------- */

export function saveEvent(userId: string, eventUid: string, kind: string, payload: unknown): boolean {
  const info = db
    .prepare(
      'INSERT OR IGNORE INTO events (event_uid,user_id,kind,payload,status,attempts,created_at) VALUES (?,?,?,?,?,0,?)',
    )
    .run(eventUid, userId, kind, JSON.stringify(payload ?? {}), 'pending', now())
  return info.changes > 0
}

/* ---------------- 推送 ---------------- */

export function addOutbox(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  messageId?: string,
): void {
  db.prepare(
    'INSERT INTO outbox (user_id,message_id,title,body,data,status,created_at) VALUES (?,?,?,?,?,?,?)',
  ).run(userId, messageId ?? null, title, body, JSON.stringify(data), 'pending', now())

  // 前台长连接即时下发；不在线时消息已落库，客户端下次 bootstrap/refresh 会补齐
  pushToUser(userId, {
    type: 'message',
    title,
    body,
    messageId: messageId ?? (typeof data.messageId === 'string' ? data.messageId : undefined),
    dutyId: typeof data.dutyId === 'string' ? data.dutyId : undefined,
    kind: typeof data.type === 'string' ? data.type : undefined,
  })
}

export function pendingOutbox(limit = 50): Row[] {
  return db.prepare('SELECT * FROM outbox WHERE status = ? ORDER BY created_at LIMIT ?').all('pending', limit) as Row[]
}

export function markOutboxSent(id: number): void {
  db.prepare('UPDATE outbox SET status = ?, sent_at = ? WHERE id = ?').run('sent', now(), id)
}

export function registerPushToken(userId: string, token: string, platform = 'android'): void {
  db.prepare(`
    INSERT INTO push_tokens (id,user_id,token,platform,created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id
  `).run(newId('p'), userId, token, platform, now())
}

export function listPushTokens(userId: string): string[] {
  const rows = db.prepare('SELECT token FROM push_tokens WHERE user_id = ?').all(userId) as Row[]
  return rows.map((row) => row.token)
}

/* ---------------- 统计 ---------------- */

export interface Stats {
  weekRate: number
  weekDelta: number
  streak: number
  nextPush: string
  todayTotal: number
  todayDone: number
  collectionInbox: number
}

export function getStats(userId: string): Stats {
  const duties = listDuties(userId)
  const today = localDate()
  const todayDuties = duties.filter((d) => d.date === today)
  const doneToday = todayDuties.filter((d) => d.status === 'done')

  const weekAgo = addDays(today, -6)
  const weekDuties = duties.filter((d) => d.date >= weekAgo && d.date <= today)
  const weekDone = weekDuties.filter((d) => d.status === 'done').length
  const rate = weekDuties.length ? Math.round((weekDone / weekDuties.length) * 100) : 0

  // 连续记录：从今天往前数，有完成记录的连续天数
  const doneDays = new Set(
    duties.filter((d) => d.doneAt).map((d) => localDate(d.doneAt!)),
  )
  let streak = 0
  for (let i = 0; i < 365; i += 1) {
    const day = addDays(today, -i)
    if (doneDays.has(day)) streak += 1
    else if (i > 0) break
  }
  if (!streak && doneToday.length) streak = 1

  const nextTimer = db
    .prepare('SELECT due_at FROM timers WHERE user_id = ? AND fired = 0 AND due_at > ? ORDER BY due_at LIMIT 1')
    .get(userId, now()) as Row | undefined
  const nextPush = nextTimer ? localTime(nextTimer.due_at) : '18:00'

  const inbox = db
    .prepare('SELECT COUNT(*) AS n FROM collections WHERE user_id = ? AND status = ?')
    .get(userId, 'inbox') as Row

  return {
    weekRate: rate,
    weekDelta: Math.min(20, Math.max(-20, Math.round(rate / 8))),
    streak: streak || 1,
    nextPush,
    todayTotal: todayDuties.length,
    todayDone: doneToday.length,
    collectionInbox: inbox.n,
  }
}
