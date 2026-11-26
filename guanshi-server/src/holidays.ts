import { HolidayUtil, Solar } from 'lunar-javascript'
import { createDuty, createTimer, listDuties, updateDuty } from './repos'
import { addDays, atLocal, localDate } from './util'

/**
 * 节日日历：公历节日、农历节日、二十四节气、法定节假日（含调休）。
 * 数据由 lunar-javascript 本地计算，节气是天文算法，不需要联网。
 * 调休安排来自库内置的国务院公告数据，跨年后需要升级库版本。
 */

export interface Festival {
  date: string
  name: string
  kind: 'solar' | 'lunar' | 'term' | 'legal'
  off?: '休' | '班'
}

/** 显示短名，同时用作待办标题和去重键 */
const SHORT_NAME: Record<string, string> = {
  元旦节: '元旦',
  腊八节: '腊八',
  元宵节: '元宵',
  龙头节: '龙抬头',
  端午节: '端午',
  七夕节: '七夕',
  中秋节: '中秋',
  重阳节: '重阳',
  国庆节: '国庆',
  圣诞节: '圣诞',
}

/** 太琐碎或与国人关系不大的，不上日历也不建待办 */
const SKIP = new Set([
  '消费者权益日',
  '愚人节',
  '全国中小学生安全教育日',
  '全国助残日',
  '全民国防教育日',
  '世界住房日',
  '万圣节',
  '万圣节前夜',
])

/** 值得建待办的节日 → 提前几天进入准备窗口 */
const ADVANCE: Record<string, number> = {
  元旦: 14,
  除夕: 14,
  春节: 14,
  元宵: 7,
  清明: 14,
  端午: 14,
  七夕: 7,
  中秋: 14,
  重阳: 7,
  腊八: 7,
  劳动节: 7,
  国庆: 14,
  儿童节: 7,
  情人节: 7,
  母亲节: 14,
  父亲节: 7,
  教师节: 3,
  平安夜: 7,
  圣诞: 7,
}

const TITLE: Record<string, string> = {
  元旦: '元旦 · 假期安排',
  除夕: '除夕 · 年夜饭与回家安排',
  春节: '春节 · 年货与拜年安排',
  元宵: '元宵 · 汤圆与灯会',
  清明: '清明 · 扫墓与出行安排',
  端午: '端午 · 粽子与回家安排',
  七夕: '七夕 · 给另一半的准备',
  中秋: '中秋 · 月饼与团聚安排',
  重阳: '重阳 · 给长辈的问候',
  腊八: '腊八 · 腊八粥的食材',
  劳动节: '劳动节 · 假期安排',
  国庆: '国庆 · 出行与预约',
  儿童节: '儿童节 · 给孩子的准备',
  情人节: '情人节 · 给另一半的准备',
  母亲节: '母亲节 · 给妈妈准备礼物',
  父亲节: '父亲节 · 给爸爸准备礼物',
  教师节: '教师节 · 给老师的问候',
  平安夜: '平安夜 · 礼物与聚会',
  圣诞: '圣诞 · 礼物与聚会',
}

const KIND_RANK: Record<Festival['kind'], number> = { lunar: 0, solar: 1, term: 2, legal: 3 }

function shortName(name: string): string {
  return SHORT_NAME[name] ?? name
}

function dayFestivals(date: string): Festival[] {
  const [year, month, day] = date.split('-').map(Number)
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const items: Festival[] = []

  const push = (raw: string, kind: Festival['kind']) => {
    if (SKIP.has(raw)) return
    const name = shortName(raw)
    if (items.some((item) => item.name === name)) return
    items.push({ date, name, kind })
  }

  for (const name of solar.getFestivals()) push(name, 'solar')
  for (const name of lunar.getFestivals()) push(name, 'lunar')
  const term = lunar.getJieQi()
  if (term) push(term, 'term')

  const holiday = HolidayUtil.getHoliday(year, month, day)
  if (holiday) {
    if (holiday.isWork()) {
      items.push({ date, name: '调休', kind: 'legal', off: '班' })
    } else {
      const name = shortName(holiday.getName())
      const existing = items.find((item) => item.name === name)
      if (existing) existing.off = '休'
      else items.push({ date, name, kind: 'legal', off: '休' })
    }
  }

  return items
}

const cache = new Map<string, Festival[]>()

function rangeKey(from: string, to: string): string {
  return `${from}~${to}`
}

/** 闭区间 [from, to] 内的节日；结果按日期升序 */
export function listFestivals(from: string, to: string): Festival[] {
  const key = rangeKey(from, to)
  const hit = cache.get(key)
  if (hit) return hit

  const items: Festival[] = []
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let ts = Date.parse(`${from}T00:00:00Z`); ts <= end; ts += 86_400_000) {
    const date = new Date(ts).toISOString().slice(0, 10)
    items.push(...dayFestivals(date))
  }
  cache.clear()
  cache.set(key, items)
  return items
}

/** 日历用：今年 1 月 1 日到明年 12 月 31 日，覆盖前后翻月 */
export function calendarFestivals(): Festival[] {
  const year = Number(localDate().slice(0, 4))
  return listFestivals(`${year}-01-01`, `${year + 1}-12-31`)
}

/** 每个节日当天取一个主标签：农历 > 公历 > 节气 > 法定 */
export function festivalMap(): Map<string, Festival> {
  const map = new Map<string, Festival>()
  for (const item of calendarFestivals()) {
    const current = map.get(item.date)
    if (!current || KIND_RANK[item.kind] < KIND_RANK[current.kind]) map.set(item.date, item)
  }
  return map
}

/**
 * 给用户生成未来一年的节日待办，幂等：
 * - 同一天已经有 type='节日' 的待办（含用户删掉的）就不再创建
 * - 提醒 timer 用固定 id，重复调用不会叠加
 */
export function ensureFestivalDuties(userId: string): number {
  const today = localDate()
  const festivals = listFestivals(today, addDays(today, 365)).filter(
    (item) => item.kind !== 'legal' && ADVANCE[item.name],
  )
  if (!festivals.length) return 0

  const existing = listDuties(userId)
  let created = 0
  for (const festival of festivals) {
    const advance = ADVANCE[festival.name]
    const current = existing.find((duty) => duty.date === festival.date && duty.type === '节日')
    // 用户已经删掉或完成了这一天的节日，就不再打扰
    if (current && (current.status === 'done' || current.status === 'dropped')) continue

    let dutyId = current?.id
    const origin = `节日日历 · ${festival.date.slice(0, 4)} · ${festival.name}`
    const title = TITLE[festival.name] || `${festival.name} · 提前准备`
    if (!dutyId) {
      const month = Number(festival.date.slice(5, 7))
      const day = Number(festival.date.slice(8, 10))

      const duty = createDuty(userId, {
        title,
        type: '节日',
        source: '周期',
        status: 'open',
        date: festival.date,
        timeLabel: `${month} 月 ${day} 日`,
        sort: 900,
        origin,
        quote: `${festival.name}（${month} 月 ${day} 日），提前 ${advance} 天进入准备窗口。`,
        rule: `提前 ${advance} 天提醒准备，提前 3 天再提醒`,
      })
      dutyId = duty.id
      created += 1
    } else if (current && current.origin === origin && current.title !== title) {
      // 我们自己生成的待办，配置改了标题就跟着更新；用户手动改过标题的不动
      updateDuty(userId, current.id, { title })
    }

    // 已有待办（含种子数据）也补上提醒，timer 用固定 id，重复调用不会叠加
    for (const offset of advance === 3 ? [3] : [advance, 3]) {
      const remindDate = addDays(festival.date, -offset)
      if (remindDate < today) continue
      createTimer(userId, atLocal(remindDate, '09:00'), {
        dutyId,
        id: `fest_${userId}_${festival.date}_${offset}`,
      })
    }
  }
  return created
}
