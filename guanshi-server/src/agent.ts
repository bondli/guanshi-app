import {
  addMemory,
  addMessage,
  addOutbox,
  createDuty,
  createTimer,
  getDuty,
  listDuties,
  listMemories,
  updateDuty,
} from './repos'
import type { Duty, Memory } from './types'
import { armByTimeLabel } from './reminders'
import { addDays, localDate, localTime } from './util'

export interface ChatResult {
  reply: string
  created: Duty[]
  updated: Duty[]
  memories: Memory[]
  usedModel: boolean
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'createDuty',
      description: '把用户提到的事情创建成一条待办。只要出现「要去做/提醒我/别忘」的意图就调用。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '简短的待办标题，不超过 20 字' },
          type: { type: 'string', description: '快递/约定/生日/节日/习惯/学校/购物/家庭/其他' },
          date: { type: 'string', description: 'YYYY-MM-DD，不明确时用今天' },
          time_label: { type: 'string', description: '展示给用户的时间，如「明天 10:00」「周五 18:00」' },
          source: { type: 'string', description: '对话/语音/短信/手动' },
          quote: { type: 'string', description: '用户原话' },
          rule: { type: 'string', description: '什么时候提醒、提醒几次' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'updateDuty',
      description: '修改已有待办，比如改时间、标记完成、放弃提醒。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', description: 'open/pending/done/dropped' },
          title: { type: 'string' },
          date: { type: 'string' },
          time_label: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'queryDuties',
      description: '查询用户的待办，用于回答「今天有什么事」「这周漏了什么」。',
      parameters: {
        type: 'object',
        properties: {
          scope: { type: 'string', description: 'today/week/all' },
          status: { type: 'string', description: 'open/pending/done，可不填' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scheduleTimer',
      description: '为某条待办安排一个提醒时间。',
      parameters: {
        type: 'object',
        properties: {
          duty_id: { type: 'string' },
          due_at: { type: 'string', description: 'ISO 时间，如 2026-11-26T10:00:00+08:00' },
        },
        required: ['duty_id', 'due_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'writeMemory',
      description: '记住用户的长期偏好、习惯或事实。闲聊里出现的稳定信息也要记。',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', description: '习惯/事实/偏好/关系' },
          text: { type: 'string' },
        },
        required: ['kind', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'readMemory',
      description: '读取用户长期记忆，回答个性化问题前可用。',
      parameters: { type: 'object', properties: {} },
    },
  },
]

function buildSystemPrompt(userId: string): string {
  const memories = listMemories(userId).slice(0, 10)
  const today = localDate()
  return [
    '你是「管事」，一个住在云端的个人生活管家，说话简短、口语化、不说教。',
    `今天是 ${today}（${localTime()}）。`,
    '用户可能只是闲聊，也可能聊着聊着落到一件要做的事上。出现明确的行动意图时，调用 createDuty 建待办，并用一句话告诉用户你记下了什么。',
    '不要编造用户没说过的时间或细节；时间不明确时给一个合理默认（比如「明天上午 10:00」），并说明可以改。',
    '同一件事不要重复创建待办；先结合已有待办判断。',
    '用户透露稳定的习惯、偏好、家人信息时，调用 writeMemory 记下来。',
    '回复控制在 60 字以内，必要时可以多一句提醒。',
    memories.length ? `已知的用户记忆：\n${memories.map((m) => `- ${m.text}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildContext(userId: string): ChatMessage[] {
  const duties = listDuties(userId)
  const today = localDate()
  const open = duties.filter((d) => d.status !== 'done' && d.status !== 'dropped')
  const lines = open.slice(0, 12).map((d) => `- ${d.title}｜${d.date} ${d.timeLabel}｜${d.status}`)
  return [
    {
      role: 'system',
      content: buildSystemPrompt(userId),
    },
    {
      role: 'system',
      content: `用户当前未完成的待办（${open.length} 条）：\n${lines.join('\n') || '（无）'}\n今天是 ${today}。`,
    },
  ]
}

async function callModel(messages: ChatMessage[], llm: LlmConfig): Promise<ChatMessage> {
  const response = await fetch(`${llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`模型接口 ${response.status}: ${await response.text()}`)
  }
  const data = (await response.json()) as {
    choices?: { message?: ChatMessage }[]
  }
  const message = data.choices?.[0]?.message
  if (!message) throw new Error('模型没有返回内容')
  return message
}

function runTool(userId: string, call: ToolCall, result: ChatResult): string {
  let args: Record<string, any> = {}
  try {
    args = JSON.parse(call.function.arguments || '{}')
  } catch {
    return JSON.stringify({ error: '参数不是合法 JSON' })
  }
  switch (call.function.name) {
    case 'createDuty': {
      const duty = createDuty(userId, {
        title: String(args.title || '未命名待办').slice(0, 40),
        type: args.type ? String(args.type) : '其他',
        source: args.source ? String(args.source) : '对话',
        date: typeof args.date === 'string' ? args.date : localDate(),
        timeLabel: args.time_label ? String(args.time_label) : '今天',
        quote: args.quote ? String(args.quote) : '',
        rule: args.rule ? String(args.rule) : '到点提醒一次',
      })
      result.created.push(duty)
      armByTimeLabel(userId, duty)
      return JSON.stringify({ ok: true, id: duty.id, title: duty.title, date: duty.date })
    }
    case 'updateDuty': {
      const id = String(args.id || '')
      const duty = updateDuty(userId, id, {
        status: args.status,
        title: args.title ? String(args.title) : undefined,
        date: args.date ? String(args.date) : undefined,
        timeLabel: args.time_label ? String(args.time_label) : undefined,
      })
      if (!duty) return JSON.stringify({ error: '没有找到这条待办' })
      result.updated.push(duty)
      return JSON.stringify({ ok: true, id: duty.id, status: duty.status })
    }
    case 'queryDuties': {
      const scope = String(args.scope || 'today')
      const today = localDate()
      const weekEnd = addDays(today, 7)
      const duties = listDuties(userId).filter((d) => {
        if (args.status && d.status !== args.status) return false
        if (scope === 'today') return d.date === today
        if (scope === 'week') return d.date >= today && d.date <= weekEnd
        return true
      })
      return JSON.stringify(
        duties.slice(0, 30).map((d) => ({
          id: d.id,
          title: d.title,
          date: d.date,
          time: d.timeLabel,
          status: d.status,
          type: d.type,
        })),
      )
    }
    case 'scheduleTimer': {
      const duty = getDuty(userId, String(args.duty_id || ''))
      const dueAt = Date.parse(String(args.due_at || ''))
      if (!duty) return JSON.stringify({ error: '没有找到这条待办' })
      if (!Number.isFinite(dueAt)) return JSON.stringify({ error: '时间格式不正确' })
      createTimer(userId, dueAt, { dutyId: duty.id })
      return JSON.stringify({ ok: true, due_at: new Date(dueAt).toISOString() })
    }
    case 'writeMemory': {
      const memory = addMemory(userId, String(args.kind || '事实'), String(args.text || '').slice(0, 200))
      result.memories.push(memory)
      return JSON.stringify({ ok: true, id: memory.id })
    }
    case 'readMemory': {
      return JSON.stringify(listMemories(userId).map((m) => ({ kind: m.kind, text: m.text })))
    }
    default:
      return JSON.stringify({ error: `未知工具 ${call.function.name}` })
  }
}

/** 客户端每次请求自带模型配置，服务端不保存 Key */
export interface LlmConfig {
  baseUrl: string
  model: string
  apiKey: string
}

/** 云端 Agent：有 Key 走模型工具调用，没 Key / 失败时走规则兜底 */
export async function chat(
  userId: string,
  text: string,
  history: { role: 'me' | 'ai'; text: string }[],
  llm?: LlmConfig | null,
): Promise<ChatResult> {
  const result: ChatResult = { reply: '', created: [], updated: [], memories: [], usedModel: false }
  if (!llm?.apiKey) {
    return fallbackChat(userId, text, result)
  }

  try {
    const messages: ChatMessage[] = [
      ...buildContext(userId),
      ...history.slice(-12).map<ChatMessage>((m) => ({
        role: m.role === 'me' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: text },
    ]

    let assistant: ChatMessage | null = null
    for (let round = 0; round < 4; round += 1) {
      assistant = await callModel(messages, llm)
      messages.push(assistant)
      const calls = assistant.tool_calls || []
      if (!calls.length) break
      for (const call of calls) {
        const toolResult = runTool(userId, call, result)
        messages.push({ role: 'tool', tool_call_id: call.id, content: toolResult })
      }
    }
    const reply = (assistant?.content || '').trim()
    if (!reply) return fallbackChat(userId, text, result)
    result.reply = reply
    result.usedModel = true
    return result
  } catch (error) {
    console.warn('[agent] 模型调用失败，降级规则解析：', (error as Error).message)
    return fallbackChat(userId, text, result)
  }
}

/* ---------------- 无模型时的规则兜底 ---------------- */

const WEEK_MAP: Record<string, string> = {
  一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 日: '7', 天: '7',
}

const CN_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
}

/** 把「三点」「十一点半」里的中文数字换成阿拉伯数字，方便后面统一解析 */
export function normalizeTimeWords(text: string): string {
  return text.replace(/([零一二两三四五六七八九十]{1,3})\s*(点|时)/g, (match, cn: string, unit: string) => {
    let value = 0
    if (cn === '十') value = 10
    else if (cn.length === 1) value = CN_DIGITS[cn] ?? 0
    else if (cn.startsWith('十')) value = 10 + (CN_DIGITS[cn[1]] ?? 0)
    else if (cn.endsWith('十')) value = (CN_DIGITS[cn[0]] ?? 0) * 10
    else if (cn.includes('十')) {
      const [tens, ones] = cn.split('十')
      value = (CN_DIGITS[tens] ?? 0) * 10 + (CN_DIGITS[ones] ?? 0)
    } else value = CN_DIGITS[cn[0]] ?? 0
    if (!value) return match
    return `${value}${unit === '时' ? '点' : unit}`
  })
}

function guessDate(text: string): { date: string; label: string } {
  const today = localDate()
  if (/大后天/.test(text)) return { date: addDays(today, 3), label: '大后天' }
  if (/后天/.test(text)) return { date: addDays(today, 2), label: '后天' }
  if (/明天|明早|明晚|明儿/.test(text)) return { date: addDays(today, 1), label: '明天' }
  const nextWeek = text.match(/下(?:周|礼拜)([一二三四五六日天])/)
  if (nextWeek) {
    const target = Number(WEEK_MAP[nextWeek[1]] || '1')
    const [y, m, d] = today.split('-').map(Number)
    const current = new Date(Date.UTC(y, m - 1, d, 4)).getUTCDay() || 7
    return { date: addDays(today, 7 - current + target), label: `下${nextWeek[0].slice(-1) === '天' ? '周日' : `周${nextWeek[1]}`}` }
  }
  const thisWeek = text.match(/(?:这|本)?(?:周|礼拜)([一二三四五六日天])/)
  if (thisWeek) {
    const target = Number(WEEK_MAP[thisWeek[1]] || '1')
    const [y, m, d] = today.split('-').map(Number)
    const current = new Date(Date.UTC(y, m - 1, d, 4)).getUTCDay() || 7
    const delta = target >= current ? target - current : 7 - current + target
    return { date: addDays(today, delta), label: `周${thisWeek[1] === '天' ? '日' : thisWeek[1]}` }
  }
  return { date: today, label: '今天' }
}

/** 把「下午 3 点」这类表达换算成 24 小时制 */
function applyPeriod(text: string, hour: number): number {
  const period = text.match(/(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|今晚|明晚|明早)/)?.[1] || ''
  if (/下午|傍晚/.test(period)) return hour < 12 ? hour + 12 : hour
  if (/晚上|夜里|今晚|明晚/.test(period)) return hour < 12 ? hour + 12 : hour
  if (/中午/.test(period)) return hour === 12 ? 12 : hour < 12 ? hour + 12 : hour
  if (/凌晨/.test(period)) return hour === 12 ? 0 : hour
  return hour
}

function guessTime(text: string): { time: string; label: string } {
  const hm = text.match(/(\d{1,2})[:：](\d{2})/)
  if (hm) {
    const h = applyPeriod(text, Number(hm[1]))
    const time = `${String(h).padStart(2, '0')}:${hm[2]}`
    return { time, label: time }
  }
  const hour = text.match(/(\d{1,2})\s*点(半)?/)
  if (hour) {
    const h = Math.min(23, applyPeriod(text, Number(hour[1])))
    const minute = hour[2] ? '30' : '00'
    return { time: `${String(h).padStart(2, '0')}:${minute}`, label: `${h}:${minute}` }
  }
  if (/明早|早上|早晨|上午/.test(text)) return { time: '09:00', label: '09:00' }
  if (/明晚|今晚|晚上|傍晚/.test(text)) return { time: '20:00', label: '20:00' }
  if (/中午/.test(text)) return { time: '12:00', label: '12:00' }
  return { time: '10:00', label: '10:00' }
}

function inferType(text: string): string {
  if (/快递|取件|驿站|包裹/.test(text)) return '快递'
  if (/生日|礼物|妈妈|爸|老婆|孩子|家人/.test(text)) return '家庭'
  if (/学校|老师|作业|跳绳|家长会/.test(text)) return '学校'
  if (/买|淘宝|京东|下单|采购|挑/.test(text)) return '购物'
  if (/高铁|火车|机票|订票|车站/.test(text)) return '行程'
  if (/开会|会议|约|见面/.test(text)) return '约定'
  return '其他'
}

function cleanupTitle(text: string): string {
  return text
    .replace(/^(帮我|麻烦|请|你)?\s*(记得|提醒我|提醒|别忘了|要)/g, '')
    .replace(/[。！!？?，,]$/g, '')
    .replace(/(大后天|明天|后天|今天|明早|今晚|明晚)/g, '')
    .replace(/(下|这|本)?(周|礼拜)[一二三四五六日天]/g, '')
    .replace(/(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上)/g, '')
    .replace(/\d{1,2}\s*[点:：]\s*\d{0,2}\s*(分|半)?/g, '')
    .replace(/^[，,、\s]+/, '')
    .trim()
    .slice(0, 20) || '新待办'
}

function fallbackChat(userId: string, text: string, result: ChatResult): ChatResult {
  const trimmed = text.trim()
  const intent = /提醒|记得|别忘|要|去买|看看|约|订|安排|准备|给我妈|给孩子/.test(trimmed)
  // 带明确时间的动作句也算，比如「下周一上午 9 点去体检」
  const hasTime = /(\d{1,2}\s*[点:：]|[一二两三四五六七八九十]{1,3}\s*[点时]|明天|今天|后天|周[一二三四五六日天]|礼拜[一二三四五六日天])/.test(trimmed)
  const hasVerb =
    /去|到|见|取|拿|缴|报名|考试|培训|开会|体检|面试|上课|出发|领|办|倒|洗|买|做|写|交|发|送|打|练|收拾|整理|还|借|修|换|寄|订|约|看|读/.test(
      trimmed,
    )
  const actionLike = intent || (hasTime && hasVerb)

  if (/这周|本周|漏了|回顾/.test(trimmed)) {
    const today = localDate()
    const weekEnd = addDays(today, 7)
    const duties = listDuties(userId).filter((d) => d.date >= today && d.date <= weekEnd && d.status !== 'done')
    result.reply = duties.length
      ? `这周还有 ${duties.length} 件没收尾：${duties.slice(0, 3).map((d) => d.title).join('、')}。要不要先挑一件？`
      : '这周没有漏下的事，挺清爽。'
    return result
  }

  if (/今天.*(什么|几件|安排)|有什么|待办/.test(trimmed) && !actionLike) {
    const today = localDate()
    const duties = listDuties(userId).filter((d) => d.date === today && d.status !== 'done')
    result.reply = duties.length
      ? `今天 ${duties.length} 件：${duties.slice(0, 4).map((d) => `${d.timeLabel} ${d.title}`).join('；')}。`
      : '今天没有待办，轻松一点。'
    return result
  }

  if (actionLike && !/^(你|在吗|你好|嗨)/.test(trimmed)) {
    const normalized = normalizeTimeWords(trimmed)
    const { date, label } = guessDate(normalized)
    const { time, label: timeOnly } = guessTime(normalized)
    const title = cleanupTitle(normalized)
    const existing = listDuties(userId).find(
      (d) => d.status !== 'done' && d.date === date && d.title.includes(title.slice(0, 4)),
    )
    if (existing) {
      result.reply = `这件事已经记着了：${existing.title}（${existing.timeLabel}）。`
      return result
    }
    const duty = createDuty(userId, {
      title,
      type: inferType(normalized),
      source: '对话',
      date,
      timeLabel: `${label} ${timeOnly}`,
      quote: `你说：${trimmed}`,
      rule: '按对话里的时间提醒一次，未完成则次日再提一次',
      sort: Number(time.replace(':', '')) || 1000,
    })
    result.created.push(duty)
    armByTimeLabel(userId, duty)
    result.reply = `记下了。${label} ${timeOnly} 提醒你：${duty.title}。`
    return result
  }

  if (/我妈|妈妈|爸爸|老婆|孩子|生日/.test(trimmed)) {
    result.reply = '我记着你家人的生日和偏好。要不要我帮你提前准备？'
    return result
  }

  result.reply = '我在。要提醒你做什么，直接说一句就行。'
  return result
}

/** 从短信 / 通知文本里抽事件，规则前置、0 token */
export function extractFromText(text: string): {
  title: string
  type: string
  timeLabel: string
  confidence: number
  quote: string
  rule: string
  date?: string
} | null {
  const raw = text.replace(/\s+/g, ' ').trim()
  const clean = normalizeTimeWords(raw)
  const parcel = clean.match(/(取件码|取货码)\s*[:：]?\s*([0-9-]+)/)
  if (parcel || /包裹|驿站|快递柜/.test(clean)) {
    const station = clean.match(/([\u4e00-\u9fa5]{2,10}驿站[\u4e00-\u9fa5]{0,6})/)?.[1] || '快递点'
    return {
      title: `取快递 · ${station}`,
      type: '快递',
      timeLabel: '18:00 前',
      confidence: parcel ? 95 : 78,
      quote: raw.slice(0, 160),
      rule: `提取到取件码 ${parcel?.[2] || '—'}；今日 18:00 提醒一次，超 48 小时加强`,
    }
  }
  if (/预约成功|挂号|体检|就诊/.test(clean)) {
    return {
      title: '按预约时间前往', type: '健康', timeLabel: '按预约', confidence: 82,
      quote: raw.slice(0, 160), rule: '提前 2 小时提醒一次',
    }
  }
  if (/航班|车次|高铁|检票/.test(clean)) {
    return {
      title: '出行提醒', type: '行程', timeLabel: '按票据时间', confidence: 76,
      quote: raw.slice(0, 160), rule: '提前 3 小时提醒',
    }
  }

  // 通用「时间 + 事情」兜底：截图/通知里最常见的形式
  const hasTime = /(\d{1,2}\s*[点:：]|明天|今天|后天|周[一二三四五六日天]|礼拜[一二三四五六日天])/.test(clean)
  const hasAction = /开会|会议|家长会|上课|面试|体检|缴费|预约|报名|签到|领取|集合|截止|到期|考试|活动|培训|出发|到店/.test(clean)
  if (hasTime && hasAction) {
    const { date, label } = guessDate(clean)
    const { label: timeOnly } = guessTime(clean)
    const topic =
      clean.match(/(家长会|开会|会议|面试|体检|缴费|报名|考试|培训|活动|领取|集合|上课)/)?.[1] || '按通知办事'
    return {
      title: topic,
      type: inferType(clean),
      date,
      timeLabel: `${label} ${timeOnly}`,
      confidence: 68,
      quote: raw.slice(0, 160),
      rule: `从文字里识别到「${label} ${timeOnly}」，提前 1 小时再提醒一次`,
    }
  }
  return null
}

export function pushTestMessage(userId: string, title: string, body: string): void {
  const message = addMessage(userId, 'ai', body, { kind: 'briefing' })
  addOutbox(userId, title, body, { messageId: message.id, type: 'test' }, message.id)
}
