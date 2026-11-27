import type { Duty } from './types'

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysISO(offset: number, base = new Date()): string {
  const d = new Date(base)
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function weekdayCN(isoStr: string): string {
  const [y, m, d] = isoStr.split('-').map(Number)
  const index = new Date(y, m - 1, d).getDay()
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][index]
}

export function dateLabel(isoStr: string): string {
  const [, m, d] = isoStr.split('-')
  return `${Number(m)} 月 ${Number(d)} 日`
}

export function shortDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/** 助手消息时间：当天只显示时间，昨天加「昨天」，更早显示日期 */
export function chatStamp(ts: number): string {
  const d = new Date(ts)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const day = localDateOf(ts)
  if (day === todayISO()) return time
  if (day === addDaysISO(-1)) return `昨天 ${time}`
  if (d.getFullYear() === new Date().getFullYear()) {
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${time}`
  }
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 ${time}`
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  return shortDate(ts)
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export type Bucket = '今天' | '明天' | '本周' | '以后'

export function bucketOf(date: string, today = todayISO()): Bucket {
  if (date <= today) return '今天'
  if (date === addDaysISO(1)) return '明天'
  if (date <= addDaysISO(7)) return '本周'
  return '以后'
}

export function isToday(date: string): boolean {
  return date === todayISO()
}

export function sortDuties(list: Duty[]): Duty[] {
  return [...list].sort((a, b) => (a.date === b.date ? a.sort - b.sort : a.date.localeCompare(b.date)))
}

export function localDateOf(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function firstLine(text: string): string {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)[0] || text
}
