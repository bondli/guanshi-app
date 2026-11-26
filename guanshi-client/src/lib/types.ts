export type DutyStatus = 'open' | 'pending' | 'done' | 'dropped'

export interface Duty {
  id: string
  userId?: string
  title: string
  type: string
  source: string
  status: DutyStatus
  confidence?: number
  date: string
  timeLabel: string
  sort: number
  origin: string
  quote: string
  rule: string
  createdAt: number
  updatedAt: number
  lastNotifiedAt?: number
  doneAt?: number
  history: { t: string; s: string }[]
}

export interface Message {
  id: string
  userId?: string
  role: 'me' | 'ai'
  text: string
  kind?: 'briefing' | 'review' | 'duty' | null
  dutyId?: string | null
  createdAt: number
  read: number
}

export interface Collection {
  id: string
  userId?: string
  type: 'link' | 'image' | 'text'
  source: string
  status: 'inbox' | 'reviewed'
  title: string
  excerpt: string
  url: string
  note: string
  imagePath?: string | null
  meta: string
  /** 剪贴板读到的原始分享文本，用于「打开原链接」时复制回去 */
  clip?: string
  createdAt: number
}

export interface Memory {
  id: string
  userId?: string
  kind: string
  text: string
  createdAt: number
}

export interface Family {
  id: string
  name: string
  relation: string
  birthday: string
  note: string
}

export interface User {
  id: string
  deviceId: string
  name: string
  plan: string
  timezone: string
  briefingTime: string
  reviewTime: string
  quietStart: string
  quietEnd: string
  reminderStyle: 'quiet' | 'standard' | 'active'
  createdAt: number
}

export interface Stats {
  weekRate: number
  weekDelta: number
  streak: number
  nextPush: string
  todayTotal: number
  todayDone: number
  collectionInbox: number
}

export interface Festival {
  date: string
  name: string
  kind: 'solar' | 'lunar' | 'term' | 'legal'
  off?: '休' | '班'
}

export interface Bootstrap {
  user: User
  stats: Stats
  duties: Duty[]
  messages: Message[]
  collections: Collection[]
  memories: Memory[]
  family: Family[]
  unread: number
  today: string
  festivals?: Festival[]
}

export interface SharePayload {
  id: string
  kind: 'image' | 'text'
  text?: string
  path?: string
  mimeType?: string
  receivedAt: number
}
