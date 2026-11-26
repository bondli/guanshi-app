import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from './config'

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT '高级版',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  briefing_time TEXT NOT NULL DEFAULT '07:30',
  review_time TEXT NOT NULL DEFAULT '21:00',
  quiet_start TEXT NOT NULL DEFAULT '22:00',
  quiet_end TEXT NOT NULL DEFAULT '07:00',
  reminder_style TEXT NOT NULL DEFAULT 'standard',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS duties (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '其他',
  source TEXT NOT NULL DEFAULT '手动',
  status TEXT NOT NULL DEFAULT 'open',
  confidence INTEGER,
  date TEXT NOT NULL,
  time_label TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  rule TEXT NOT NULL DEFAULT '',
  history TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_notified_at INTEGER,
  done_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_duties_user_date ON duties(user_id, date);
CREATE INDEX IF NOT EXISTS idx_duties_user_status ON duties(user_id, status);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_uid TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  picked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, created_at);

CREATE TABLE IF NOT EXISTS timers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  duty_id TEXT,
  kind TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  fired INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timers_due ON timers(fired, due_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  kind TEXT,
  duty_id TEXT,
  created_at INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  message_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, created_at);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '事实',
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'link',
  source TEXT NOT NULL DEFAULT '网页',
  status TEXT NOT NULL DEFAULT 'inbox',
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  image_path TEXT,
  meta TEXT NOT NULL DEFAULT '',
  clip TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id, created_at);

CREATE TABLE IF NOT EXISTS family (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT '',
  birthday TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })

export const db = new Database(config.dbPath)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('busy_timeout = 5000')
db.pragma('foreign_keys = ON')
db.exec(schema)

// 轻量迁移：老库缺列时补上
function ensureColumn(table: string, column: string, ddl: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
}
ensureColumn('collections', 'clip', "clip TEXT NOT NULL DEFAULT ''")

export function closeDb(): void {
  try {
    db.close()
  } catch {
    // ignore
  }
}
