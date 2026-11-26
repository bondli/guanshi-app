import { randomUUID } from 'node:crypto'

export const TZ = process.env.TZ || 'Asia/Shanghai'

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`
}

export function now(): number {
  return Date.now()
}

/** 本地日期 YYYY-MM-DD */
export function localDate(ts: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ts))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** 本地时间 HH:mm */
export function localTime(ts: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ts))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('hour')}:${get('minute')}`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 本地星期（用 UTC 中午规避时区边界） */
export function weekdayCN(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 4)).getUTCDay()]
}

/** dateStr 当天 HH:mm 的本地时间戳 */
export function atLocal(dateStr: string, timeStr = '09:00'): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  // 先按 UTC 生成，再根据时区差回推，避免依赖宿主时区
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0, 0)
  const offset = tzOffsetMs(guess)
  return guess - offset
}

function tzOffsetMs(ts: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(new Date(ts))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUTC - ts
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** 「今天 14:32」这类相对时间 */
export function relativeLabel(ts: number): string {
  const date = localDate(ts)
  const today = localDate()
  const time = localTime(ts)
  if (date === today) return `今天 ${time}`
  if (date === addDays(today, -1)) return `昨天 ${time}`
  return `${date.slice(5).replace('-', ' 月 ')} 日 ${time}`
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
