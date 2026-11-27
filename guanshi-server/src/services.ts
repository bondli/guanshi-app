import { extractFromText } from './agent'
import { config } from './config'
import { db } from './db'
import {
  addMessage,
  addOutbox,
  createDuty,
  createTimer,
  dueTimers,
  fireTimer,
  getDuty,
  getUser,
  listDuties,
  listPushTokens,
  markOutboxDelivered,
  markOutboxSent,
  pendingOutbox,
  pendingOutboxForUser,
  removePushToken,
  updateDuty,
} from './repos'
import type { Duty } from './types'
import { sendHuaweiPush } from './huawei'
import { ensureFestivalDuties } from './holidays'
import { pushToUser } from './stream'
import { addDays, atLocal, localDate, localTime, now } from './util'

/* ---------------- 推送分发 ---------------- */

function inQuietHours(quietStart: string, quietEnd: string, time = localTime()): boolean {
  if (quietStart === quietEnd) return false
  if (quietStart < quietEnd) return time >= quietStart && time < quietEnd
  return time >= quietStart || time < quietEnd
}

/**
 * 厂商推送：目前只接了华为 Push Kit（自用设备是华为手机），实现见 huawei.ts。
 * 之后要加小米/OPPO/vivo 时，按 push_tokens.platform 在这里分流即可；
 * 前提仍然是客户端先拿到 token 并调 POST /api/push-token 上报。
 */
async function deliver(userId: string, title: string, body: string, data: Record<string, unknown>): Promise<boolean> {
  const tokens = listPushTokens(userId)
  // 没有任何厂商 token 就直接失败，避免离线用户每条消息每 30s 刷一行日志
  if (!tokens.length) return false
  const messageId = typeof data.messageId === 'string' ? data.messageId : undefined
  let delivered = false
  for (const token of tokens) {
    const result = await sendHuaweiPush(token, { title, body, messageId })
    if (result.ok) {
      delivered = true
      continue
    }
    if (result.invalidToken) {
      removePushToken(token)
      console.warn(`[push] ${userId} 的华为 token 已失效，已删除`)
      continue
    }
    console.warn(`[push] ${userId} 下发失败 ${result.code ?? ''} ${result.message ?? ''}`.trim())
  }
  if (delivered) console.log(`[push] → ${userId} ${title}`)
  return delivered
}

export async function dispatchOutbox(): Promise<void> {
  const rows = pendingOutbox()
  for (const row of rows) {
    // 超过 24 小时还没送达就放弃，避免离线用户积压无限增长
    if (now() - Number(row.created_at) > 24 * 3600_000) {
      markOutboxSent(row.id)
      continue
    }
    const ok = await deliver(row.user_id, row.title, row.body, JSON.parse(row.data || '{}'))
    if (ok) markOutboxSent(row.id)
  }
}

/** 客户端 WebSocket 连上时调用：把离线期间积压的提醒一次性补发 */
export function flushPendingToUser(userId: string): void {
  const rows = pendingOutboxForUser(userId)
  if (!rows.length) return
  const latest = rows[rows.length - 1]
  const data = JSON.parse(latest.data || '{}') as Record<string, unknown>
  const count = rows.length
  const delivered = pushToUser(userId, {
    type: 'backlog',
    count,
    title: count > 1 ? `你有 ${count} 条提醒` : latest.title,
    body: count > 1 ? `${latest.title} 等 ${count} 条，点开助手查看` : latest.body,
    messageId: typeof data.messageId === 'string' ? data.messageId : undefined,
    kind: typeof data.type === 'string' ? data.type : undefined,
  })
  if (delivered) {
    markOutboxDelivered(rows.map((row) => row.id))
    console.log(`[stream] ${userId} 补发 ${count} 条积压提醒`)
  }
}

/* ---------------- 晨报 / 复盘（纯模板，0 token） ---------------- */

function todayOpen(userId: string): Duty[] {
  const today = localDate()
  return listDuties(userId)
    .filter((d) => d.date === today && d.status !== 'done' && d.status !== 'dropped')
    .sort((a, b) => a.sort - b.sort)
}

export function sendBriefing(userId: string): { title: string; messageId: string } {
  const user = getUser(userId)
  const list = todayOpen(userId)
  const date = localDate()
  const title = list.length ? `今天 ${list.length} 件事` : '今天没有待办，轻松一点'
  const body = list.length
    ? list.slice(0, 6).map((d) => `· ${d.timeLabel} ${d.title}`).join('\n')
    : '今天没有安排。想做点什么，对我说一句就行。'
  const message = addMessage(userId, 'ai', `${title}\n${body}`, { kind: 'briefing' })
  if (user && !inQuietHours(user.quietStart, user.quietEnd)) {
    addOutbox(userId, title, body, { type: 'briefing', messageId: message.id, date }, message.id)
  }
  console.log(`[briefing] ${userId} ${date}`)
  return { title, messageId: message.id }
}

export function sendReview(userId: string): { title: string; messageId: string } {
  const user = getUser(userId)
  const today = localDate()
  const list = listDuties(userId).filter((d) => d.date === today)
  const done = list.filter((d) => d.status === 'done')
  const open = list.filter((d) => d.status !== 'done' && d.status !== 'dropped')
  const title = `今天完成 ${done.length} / ${list.length}`
  const lines = [
    ...done.slice(0, 5).map((d) => `✓ ${d.title}`),
    ...open.slice(0, 5).map((d) => `○ ${d.title}`),
  ]
  const body = lines.length ? lines.join('\n') : '今天没有安排，也算好好休息。'
  const message = addMessage(userId, 'ai', `${title}\n${body}`, { kind: 'review' })
  if (user && !inQuietHours(user.quietStart, user.quietEnd)) {
    addOutbox(userId, title, body, { type: 'review', messageId: message.id, date: today }, message.id)
  }
  console.log(`[review] ${userId} ${today}`)
  return { title, messageId: message.id }
}

/* ---------------- 定时提醒 ---------------- */

export function armReminder(userId: string, dutyId: string, dueAt: number): void {
  createTimer(userId, dueAt, { dutyId })
}

function remindDuty(userId: string, dutyId: string | null): void {
  if (!dutyId) return
  const duty = getDuty(userId, dutyId)
  if (!duty || duty.status === 'done' || duty.status === 'dropped') return
  const user = getUser(userId)
  const today = localDate()
  // 提前提醒（比如节日提前 14 天）时 duty.date 还在未来，别说「到点了」
  const text = duty.date === today
    ? `${duty.timeLabel} 到点了：${duty.title}`
    : `${duty.title}｜${Number(duty.date.slice(5, 7))} 月 ${Number(duty.date.slice(8, 10))} 日，可以开始准备了`
  const message = addMessage(userId, 'ai', text, { kind: 'duty', dutyId: duty.id })
  updateDuty(userId, duty.id, { lastNotifiedAt: now() })
  if (user && !inQuietHours(user.quietStart, user.quietEnd)) {
    addOutbox(userId, '该做这件事了', text, { type: 'duty', dutyId: duty.id, messageId: message.id }, message.id)
  }
}

/* ---------------- 事件处理 ---------------- */

export function handleEvent(userId: string, kind: string, payload: Record<string, unknown>): void {
  const text = typeof payload.text === 'string' ? payload.text : ''
  if (!text) return
  const extracted = extractFromText(text)
  if (!extracted) return
  const today = localDate()
  const duty = createDuty(userId, {
    title: extracted.title,
    type: extracted.type,
    source: kind === 'sms' ? '短信' : kind === 'notification' ? '通知' : '其他',
    status: 'pending',
    confidence: extracted.confidence,
    date: extracted.date || today,
    timeLabel: extracted.timeLabel,
    quote: extracted.quote,
    origin: `${kind === 'sms' ? '短信' : '通知'} · ${localTime()} · 待确认`,
    rule: extracted.rule,
    sort: 1800,
  })
  const message = addMessage(userId, 'ai', `从${kind === 'sms' ? '短信' : '通知'}里发现一件事：${duty.title}。要我记下来吗？`, {
    kind: 'duty',
    dutyId: duty.id,
  })
  addOutbox(userId, '发现一件待办', message.text, { type: 'duty', dutyId: duty.id, messageId: message.id }, message.id)
}

/* ---------------- 调度器 ---------------- */

let timer: NodeJS.Timeout | null = null
let festivalSyncedOn = ''

/** 每天第一次 tick 时，给所有用户补齐未来一年的节日待办 */
function ensureFestivalDutiesDaily(): void {
  const today = localDate()
  if (festivalSyncedOn === today) return
  festivalSyncedOn = today
  const users = db.prepare('SELECT id FROM users').all() as { id: string }[]
  for (const user of users) {
    try {
      const created = ensureFestivalDuties(user.id)
      if (created) console.log(`[festival] ${user.id} 新增 ${created} 条节日待办`)
    } catch (error) {
      console.warn('[festival] 生成节日待办失败', error)
    }
  }
}

function ensureDailyTimers(): void {
  const today = localDate()
  const tomorrow = addDays(today, 1)
  const users = db.prepare('SELECT id,briefing_time,review_time FROM users').all() as {
    id: string
    briefing_time: string
    review_time: string
  }[]
  for (const user of users) {
    for (const date of [today, tomorrow]) {
      createTimer(user.id, atLocal(date, user.briefing_time), {
        kind: 'briefing',
        id: `briefing_${user.id}_${date}`,
      })
      createTimer(user.id, atLocal(date, user.review_time), {
        kind: 'review',
        id: `review_${user.id}_${date}`,
      })
    }
  }
}

function tick(): void {
  try {
    ensureDailyTimers()
    ensureFestivalDutiesDaily()
    const timers = dueTimers(now())
    for (const item of timers) {
      if (item.kind === 'briefing') sendBriefing(item.user_id)
      else if (item.kind === 'review') sendReview(item.user_id)
      else remindDuty(item.user_id, item.duty_id)
      fireTimer(item.id)
    }

    // 处理端侧上报的事件
    const events = db
      .prepare('SELECT * FROM events WHERE status = ? ORDER BY created_at LIMIT 20')
      .all('pending') as { id: number; user_id: string; kind: string; payload: string }[]
    for (const event of events) {
      try {
        handleEvent(event.user_id, event.kind, JSON.parse(event.payload || '{}'))
        db.prepare('UPDATE events SET status = ? WHERE id = ?').run('done', event.id)
      } catch (error) {
        console.warn('[event] 处理失败', error)
        db.prepare('UPDATE events SET status = ?, attempts = attempts + 1 WHERE id = ?').run('failed', event.id)
      }
    }

    void dispatchOutbox()
  } catch (error) {
    console.warn('[scheduler] tick failed', error)
  }
}

export function startScheduler(): void {
  if (timer) return
  tick()
  timer = setInterval(tick, 30_000)
  console.log(`[scheduler] 已启动，时区 ${config.timezone}，30s 一轮`)
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer)
  timer = null
}
