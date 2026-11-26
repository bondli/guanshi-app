# 管事 GuanShi — 技术方案

> 配套产品方案：[product-plan.md](./product-plan.md)
> 版本 v4.0 | 2026-11-25

---

## 一、架构总览

### 1.1 端云职责

| 层 | 职责 | 关键约束 |
|---|---|---|
| **Android 端** | 采集（短信/通知/语音/图片）、展示、本地兜底提醒、推送接收 | 杀 App 后仅推送可达；采集靠权限 + 保活 |
| **云端（单机 Node）** | Agent 推理、Duty 存储、定时调度、晨报晚报生成、推送分发、记忆 | Express + PM2 fork 单实例 + SQLite，无 Redis |

### 1.2 全景图

```
┌──────────────────────────────────────────────────────────────┐
│                  Android 端 (Expo prebuild + RN)              │
│  UI 层      gluestack-ui(shadcn 风格) + NativeWind           │
│  服务层     SyncService / LocalCache / PushHandler / Fallback │
│  原生模块   SmsModule / NlsModule / OcrModule / AsrModule     │
│            ShareModule / CollectWorker / BootReceiver          │
│  语音      讯飞听写（在线 / 离线包可选，音频不经我方服务器）     │
│  图片      ML Kit OCR（端侧出文字，只上文本）                  │
└──────────┬───────────────────────────────────▲──────────────┘
           │ HTTPS 上报事件 / 拉取 Duty          │ 厂商推送（杀 App 可达）
┌──────────▼───────────────────────────────────┴──────────────┐
│             云端单进程 Node (PM2 fork × 1)                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Express API                                            │  │
│  │  /auth  /events  /duties  /chat  /memory  /push-token   │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 进程内调度器（node-cron 每 30s，替代 Redis 队列）        │  │
│  │  timer 扫描 → 写 inbox → 唤醒 agent worker             │  │
│  │  push 消费者 → 出站 → 厂商 SDK                          │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Agent Worker（@earendil-works/pi-agent-core）           │  │
│  │  单用户串行；工具调用；compaction；session tree         │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ DAWN 打分（纯 TS，0 token） + 模板话术生成（0 token）    │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ SQLite (better-sqlite3, WAL)：                          │  │
│  │  users / duties / events / timers / messages / outbox / │  │
│  │  memories / memories_fts(FTS5) / sessions               │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
              LLM Provider（DeepSeek / 通义 / Claude，按需切换）
```

### 1.3 一个重要的架构红利

Agent 从端侧搬到云端后，**不再受 React Native / Hermes 的 JS 运行时限制**。`pi-agent-core` 是标准 Node 库，长连接、streaming、tool call 都是原生能力。原来最大的技术风险（Hermes 兼容性）直接消失。

---

## 二、端侧技术设计

### 2.1 工程形态

| 项 | 选择 | 说明 |
|---|---|---|
| 框架 | Expo **prebuild（bare）** + React Native + TypeScript | 必须 prebuild，因为要改 AndroidManifest、写 Kotlin 模块 |
| 开发运行 | `expo run:android`（dev client） | 不能用 Expo Go |
| UI | gluestack-ui v4+（shadcn 风格）+ NativeWind | 组件统一封装在 `components/ui/`，页面禁止散写样式 |
| 本地存储 | expo-sqlite（Duty 只读缓存）+ MMKV（token/偏好，加密） | 离线可看历史 |
| 网络 | 自建 ApiClient：超时、重试、离线队列 | 上报失败本地暂存，下次补发 |

### 2.2 原生模块清单

| 模块 | 实现要点 | 权限 |
|---|---|---|
| `SmsModule` | `ContentObserver` 监听 `content://sms`；**正则预筛在 Kotlin 侧完成**，只把命中片段回传 JS | `READ_SMS` |
| `NlsModule` | `NotificationListenerService`，按用户勾选的包名过滤，提取 title/text | 通知使用权（手动开） |
| `OcrModule` | ML Kit Text Recognition（中文），端侧出文字 | 无 |
| `AsrModule` | 讯飞 IAT SDK 封装（见 §2.3） | `RECORD_AUDIO` |
| `ShareModule` | `ACTION_SEND` / `ACTION_SEND_MULTIPLE` 接收外部分享（见 §2.5）；冷启动取 initial intent，热启动走 `onNewIntent` | 无 |
| `CollectWorker` | WorkManager 周期任务（15–30 min）：补采短信、补传离线队列 | — |
| `BootReceiver` | `BOOT_COMPLETED` 重启采集服务 | — |

### 2.3 语音方案：讯飞语音听写（IAT）

| 项 | 说明 |
|---|---|
| 方案 | 科大讯飞语音听写（iFlytek IAT）Android SDK |
| 模式 | **在线听写**（准确率高）优先；离线听写需单独授权包，可选 |
| 限制 | 单次听写有录音时长上限（约 60s），超出需分段续传 |
| 交互 | 按住说话 / 点击开始-停止；实时返回中间结果，结束后给最终文本 |
| 输出 | 只把**文本**上报我们的云端，音频不落盘；在线模式下音频只发往讯飞，离线包则完全不出设备 |
| 兜底 | 讯飞初始化失败时降级到系统 `SpeechRecognizer` |
| 收益 | 云端拿到的永远是文本，**省掉音频上传带宽 + 云端 ASR 的 token/算力** |

> 注：产品需求里写的是"飞讯"，按科大讯飞处理。若指其他厂商，仅需替换 SDK 封装层，接口不变。

### 2.4 图片：端侧 OCR 先行

这是一个重要的省钱设计：

```
用户发图 / 分享截图
  ↓
端侧 ML Kit OCR → 纯文本
  ↓
只把文本上报（不上传图片）
  ↓
云端 LLM 做语义理解（"这是张三约我下周三吃饭"）
```

对比：直接传图给视觉模型，一张图约 800–1500 tokens；OCR 后文本约 200–400 tokens。**约省 60–75%**，且更快、更隐私。

图片本身仅在本地缓存供用户自己回看，不上云。

### 2.5 分享接入（ACTION_SEND）

Android 分享面板是收藏的唯一低摩擦入口。需要在 `AndroidManifest.xml` 注册 intent-filter：

```xml
<activity android:name=".MainActivity" android:launchMode="singleTask">
  <intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
  </intent-filter>
  <intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
  </intent-filter>
  <intent-filter>
    <action android:name="android.intent.action.SEND_MULTIPLE" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="image/*" />
  </intent-filter>
</activity>
```

- `launchMode="singleTask"` + `onNewIntent` 处理热启动；冷启动用 `getIntent()` 取初始分享
- Expo 侧用 config plugin 注入上述 intent-filter，避免手改 Manifest 被 prebuild 覆盖

**接收与处理**

```
ShareModule.getSharedContent()
  → { type: 'text'|'image', text, uris[] }
  → 端侧预判：
      text 含 URL  → 收藏为链接
      纯文本       → 收藏为文字
      image/*      → 图片存本地沙盒，收藏为图片
  → POST /collections
  → 云端抓 OG 元数据（标题 / 封面 / 站点），失败则用首行文本兜底
  → 返回收藏卡，端侧弹一条轻提示
```

**来源识别（必须说清的限制）**

Android 的 `ACTION_SEND` **不携带来源 App 的包名**。只能用内容推断：

| 手段 | 可靠性 |
|---|---|
| 链接域名（`v.douyin.com` / `mp.weixin.qq.com` / `xhslink.com`） | 高，覆盖绝大多数 |
| 文本特征（抖音口令、公众号标题格式） | 中 |
| 用户手动改来源 | 兜底 |

不要用 `getReferrer()` 或最近任务栈猜来源，不可靠且涉及隐私。

**图片存储**

- 原图复制到沙盒 `files/collections/`，卸载即删
- 列表只加载长边 320px 的缩略图，点开详情才读原图
- 默认不上传原图；只有用户把收藏「转成待办」且需要理解时，才走 OCR 上文本

### 2.6 本地兜底

| 场景 | 兜底机制 |
|---|---|
| 推送未到达 | 同步到端侧的 Duty 同时注册 AlarmManager 本地提醒 |
| 断网 | 本地 SQLite 可查看历史 Duty；新建 Duty 进离线队列 |
| 云端不可用 | 本地提醒照常触发，恢复后补同步 |

### 2.7 保活（针对国产 ROM）

| 手段 | 说明 |
|---|---|
| WorkManager 周期任务 | 主要拉活手段，周期 15–30 min |
| 短信历史补采 | 关键：被杀期间错过的短信，下次拉活查 `content://sms` 补回，**不丢** |
| 推送透传拉起 | 云端高优事件用透传消息唤醒端侧处理 |
| 保活引导 | 分厂商图文引导：关闭电池优化、允许自启动、后台加锁 |
| 前台服务（可选） | 用户主动开启"高可靠模式"时使用常驻通知 |

> 已知限制：**通知监听无法补采历史**（不像短信有数据库可查）。文档与设置页需明示。

---

## 三、云端技术设计

### 3.1 进程模型：Express + PM2（单实例）

```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'guanshi',
    script: 'dist/server.js',
    exec_mode: 'fork',        // 关键：不能用 cluster
    instances: 1,             // 关键：SQLite 单写者
    max_memory_restart: '600M',
    kill_timeout: 5000,       // 优雅退出，等 SQLite 关闭
    env: { NODE_ENV: 'production', TZ: 'Asia/Shanghai' }
  }]
}
```

**为什么必须 fork × 1**：

- SQLite 同一时刻只允许一个写者。PM2 cluster 多进程会频繁 `SQLITE_BUSY`，且 WAL 下跨进程协调很差
- 多个进程同时跑 cron → 定时任务重复触发
- 多个进程抢 `events` 表 → 需要额外分布式锁

**取舍**：MVP 阶段 API + 调度器 + Agent Worker 放在**同一个进程**内，用模块隔离。单机可支撑数千用户量级，足够验证产品。真到了瓶颈，按 §3.6 迁移 PostgreSQL 后再拆进程。

**优雅退出**：监听 `SIGINT/SIGTERM`，停止接受新请求 → 等当前 agent run 结束 → `db.close()`。

### 3.2 数据库：服务端 SQLite（better-sqlite3）

```js
const Database = require('better-sqlite3')
const db = new Database('./data/guanshi.db')
db.pragma('journal_mode = WAL')      // 读写不互斥
db.pragma('synchronous = NORMAL')    // 性能与安全平衡
db.pragma('busy_timeout = 5000')
db.pragma('foreign_keys = ON')
```

**为什么够用**：

| 维度 | 评估 |
|---|---|
| 写入量 | 每用户每天约 10–30 次写（事件、Duty 状态、推送记录）。1000 用户 ≈ 1 万次/天 ≈ 0.1 次/秒 |
| 读取量 | 首页拉取、晨报生成，均为小查询，走索引 |
| SQLite 能力 | 单机 WAL 模式可持续数百次/秒写入，远超 MVP 需求 |
| 运维成本 | 一个文件，零运维，备份 = 复制文件 |

**天花板（必须心里有数）**：

- 写入是串行的，高并发写场景会阻塞（如秒杀式批量推送）
- 无法水平扩展（不能加机器）
- 单机故障 = 数据不可用（靠备份恢复）

**应急预案**：若推送风暴导致写入排队，把批量推送改为**分批 + 限流**（每批 200 条，间隔 1s），避免长事务。

**迁移路径（提前埋好）**：

- 所有数据访问走 `repositories/` 层，不写裸 SQL 到业务代码
- 使用 Drizzle ORM 的 SQLite/PG 双方言能力，迁移时改连接与少量方言差异
- 避免使用 SQLite 特有语法（如 `INSERT OR REPLACE` 之外的非标特性）

### 3.3 无 Redis 的替代设计

| Redis 原本用途 | SQLite 替代方案 |
|---|---|
| **任务队列** | `events` 表 + 进程内轮询 worker（见下） |
| **定时任务** | `timers` 表 + `node-cron` 每 30s 扫描到期记录 |
| **分布式锁** | 单进程 → 进程内 `async-mutex`；按用户串行队列 |
| **限流** | 进程内 Map + 令牌桶（单机有效） |
| **缓存** | 进程内 LRU（`lru-cache`），无需外部缓存 |
| **发布订阅** | 单进程直接函数调用，不需要 |

**事件队列实现（核心）**：

```ts
// 原子领取，避免重复处理
const claimNext = db.prepare(`
  UPDATE events
     SET status = 'processing', worker_id = ?, picked_at = ?
   WHERE id = (
     SELECT id FROM events
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT 1
   )
   RETURNING *
`)
```

- 单进程 → 天然无并发争抢；`status` 字段仍保留，便于崩溃后重置为 `pending`
- 每 200–500ms 轮询一次，或用 `setImmediate` 驱动（有事件时立即处理）
- 事件去重：`event_uid` 唯一索引（端侧生成的幂等 ID），重复上报直接忽略
- 失败重试：`attempts` 字段 + 指数退避（1s/5s/30s/5min），超过 5 次进 `dead_letter`

### 3.4 定时器与每日仪式

```
node-cron 每 30 秒：
  ├── 扫 timers 表：due_at <= now 且未触发 → 写 events → 标记 fired
  ├── 扫 users 表：本地时间命中晨报时间(默认 07:30) → 生成晨报事件
  ├── 扫 users 表：命中晚报时间(默认 21:00) → 生成晚报事件
  └── 扫 outbox：pending → 推送分发（限流分批）
```

**晨报生成（0 token）**：

```ts
// 纯模板，不调 LLM
const today = duties.filter(d => isToday(d.deadline) || d.status === 'in_progress')
const push = {
  title: today.length ? `今天 ${today.length} 件事` : '今天没有待办，轻松一点',
  body: today.map(d => `· ${fmtTime(d.deadline)} ${d.title}`).join('\n'),
  actions: [
    { id: 'open', title: '打开管事' }
  ],
  data: { type: 'briefing', dutyIds: today.map(d => d.id) }
}
```

**晚报生成（0 token）**：

```
已完成 X / 共 Y
✅ 逐条列出完成项
⬜ 未完成项 + [明天提醒] [已完成] [放弃]
本周完成率 Z%（与上周对比）
```

**通知栏直接操作（关键体验）**：

- Android 通知带 action 按钮，点击直接调 `POST /duties/:id/complete`
- 无需打开 App 即可完成回执
- **确认即止**：`status='done'` 的 Duty 在 DAWN 打分阶段直接跳过；`last_notified_at` + 冷却窗口保证同一 Duty 同一时段只提醒一次

### 3.5 Agent 设计

**集成方式**：

```ts
const agent = new Agent({
  initialState: {
    systemPrompt: buildSystemPrompt(user, memories),  // 稳定前缀，利于缓存
    model,                                            // 按任务选模型
  },
  streamFn: models.streamSimple.bind(models),
})
```

**工具集（注册给 agent）**：

| 工具 | 副作用 | 权限 |
|---|---|---|
| `createDuty` / `updateDuty` / `completeDuty` | 写库 | 自动 |
| `queryDuties` / `getTodayBriefing` | 读库 | 自动 |
| `scheduleTimer` / `cancelTimer` | 写库 | 自动 |
| `pushNow` | 发推送 | 需用户在当前会话确认 |
| `readMemory` / `writeMemory` | 写记忆 | 自动 |
| `deleteDuty` / `purgeMemory` | 删数据 | **必须**用户确认（deferred） |

**并发模型**：单用户串行。一个用户同时只跑一个 agent run，后续事件排队合并（用户连发三条消息 → 合并成一轮）。

**与产品仪式的分工**：

| 场景 | 是否用 LLM |
|---|---|
| 晨报 / 晚报 | ❌ 模板生成（0 token） |
| 提醒推送话术 | ❌ 模板 + 变量（0 token） |
| 短信快递识别 | ⚠️ 正则优先；未命中才用便宜模型 |
| 截图文字 → Duty | ✅ 用 LLM 做语义理解 |
| 用户对话 | ✅ 用 LLM（唯一必须的） |
| 周回顾 | ❌ 统计 + 模板；可选一句 LLM 点评 |

**原则：LLM 只用于"理解自然语言"，绝不用于"调度和措辞"。**

### 3.6 推送分发与「通知即对话」

推送与助手消息**同源**：先写一条消息，再发推送。保证用户点开时，对话里一定有对应的那句话。

```
outbox(pending)
  → 同一事务内写 messages(origin='push', kind=briefing|duty|review, ref_id)
  → 按 userId 查 push_token + 设备厂商
  → 推送 data 携带 { messageId, kind, dutyId }
  → 路由通道：FCM / 小米 / 华为 / OPPO / vivo
  → 成功标记 sent；失败退避重试
  → 全部失败 → 标记 failed，用户下次打开 App 时在对话里补展示（消息已存在）
```

端侧点击推送 → 深链 `guanshi://assistant?messageId=...` → 打开助手 Tab → 定位并高亮该条消息 → 清未读点。

**去重与合并**：同一 Duty 同一天的多条提醒复用同一 `messageId`，只更新 `notify_count` 与文案，不新增消息行，避免刷屏。

MVP 先接 FCM + 小米，其余按用户设备分布逐步补。

---

## 四、数据模型（SQLite）

```sql
PRAGMA journal_mode = WAL;

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  tz            TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  push_style    TEXT NOT NULL DEFAULT 'standard',  -- quiet|standard|active
  briefing_at   TEXT NOT NULL DEFAULT '07:30',
  review_at     TEXT NOT NULL DEFAULT '21:00',
  created_at    INTEGER NOT NULL
);

CREATE TABLE duties (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  type          TEXT NOT NULL,      -- PARCEL|PROMISE|FESTIVAL|HABIT|BIRTHDAY|SCHOOL
  source        TEXT NOT NULL,      -- SMS|NOTIFICATION|VOICE|IMAGE|MANUAL|RECURRING
  title         TEXT NOT NULL,
  content       TEXT,
  deadline      INTEGER,
  window_start  INTEGER,
  window_end    INTEGER,
  extracted     TEXT,               -- JSON
  recurrence    TEXT,               -- RRULE
  confidence    REAL,
  status        TEXT NOT NULL DEFAULT 'discovered',
  notify_count  INTEGER NOT NULL DEFAULT 0,
  last_notified_at INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_duties_user_status ON duties(user_id, status, deadline);

CREATE TABLE events (             -- Event Inbox（替代 Redis 队列）
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  event_uid     TEXT UNIQUE,      -- 幂等去重
  kind          TEXT NOT NULL,    -- sms|notification|voice|image|timer|user_msg|briefing|review
  payload       TEXT NOT NULL,    -- JSON
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|done|dead
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_events_status ON events(status, created_at);

CREATE TABLE timers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  duty_id       TEXT,
  kind          TEXT NOT NULL,    -- followup|recurring|briefing|review
  due_at        INTEGER NOT NULL,
  rrule         TEXT,
  fired         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_timers_due ON timers(fired, due_at);

CREATE TABLE outbox (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  message_id    TEXT,             -- 与 messages 同源，点击推送时定位
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  data          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE messages (           -- 助手对话流，推送与聊天共用
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  role          TEXT NOT NULL,    -- user|agent
  kind          TEXT NOT NULL,    -- text|duty|briefing|review
  ref_id        TEXT,             -- duty_id 或批次 id
  body          TEXT NOT NULL,
  payload       TEXT,             -- JSON：卡片所需的数据快照
  origin        TEXT NOT NULL DEFAULT 'chat',  -- chat|push
  read_at       INTEGER,
  notify_count  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);

CREATE TABLE collections (        -- 收藏：与 Duty 是两种实体，互不污染
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  type          TEXT NOT NULL,    -- link|image|text
  source_app    TEXT,             -- douyin|wechat|xhs|web|null（由域名推断）
  url           TEXT,
  title         TEXT NOT NULL,
  excerpt       TEXT,
  cover_url     TEXT,
  local_path    TEXT,             -- 图片收藏的沙盒路径
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'inbox',  -- inbox|reviewed|archived
  reviewed_at   INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_collections_user ON collections(user_id, status, created_at DESC);

CREATE TABLE memories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  kind          TEXT NOT NULL,    -- instruction|fact|pattern
  content       TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE VIRTUAL TABLE memories_fts USING fts5(
  content, content='memories', content_rowid='id'
);

CREATE TABLE sessions (           -- pi-agent-core 会话归档
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  messages      TEXT NOT NULL,    -- JSON
  summary       TEXT,
  updated_at    INTEGER NOT NULL
);
```

**SQLite 的额外收益**：`memories_fts` 用 FTS5 做全文检索，**不需要向量库**就能按关键词召回相关记忆——省一个组件，也省 token（见 §5）。

---

## 五、Token 节省专项（重点）

### 5.1 分层漏斗

```
输入信号 100%
   │
   ├─ 层 0：规则/正则命中 → 直接生成 Duty，LLM 调用 = 0
   │        覆盖：快递短信约 85%、周期 Duty 100%、晨报晚报 100%
   │
   ├─ 层 1：端侧预处理 → 图片转文字、语音转文字，只上文本
   │        省：约 60–75% 的输入 token
   │
   ├─ 层 2：小模型分类/抽取（便宜模型 + JSON schema + max_tokens 限制）
   │        覆盖：短信兜底解析、通知摘要判断
   │
   └─ 层 3：大模型只在必要时用（对话理解、复杂约定解析、多步规划）
```

### 5.2 十二条具体措施

| # | 措施 | 节省效果 |
|---|---|---|
| 1 | **规则前置**：快递短信正则命中直接建 Duty | 该场景 100% 免调用 |
| 2 | **端侧 OCR**：图片只传文字 | 单图省 60–75% 输入 |
| 3 | **端侧 ASR**：讯飞听写只传文本 | 免除音频上传与云端 ASR |
| 4 | **收藏零模型**：链接只抓 OG 元数据，不自动摘要 | 收藏场景 100% 免调用 |
| 4 | **模型分层**：抽取用便宜模型（DeepSeek），复杂推理才用贵模型 | 单次成本降 5–10 倍 |
| 5 | **结构化输出**：JSON Schema 约束 + `max_tokens` 上限 | 避免输出冗长，省 30–50% 输出 |
| 6 | **模板话术**：所有提醒/晨报/晚报不调 LLM | 每日 2–3 次推送成本归零 |
| 7 | **稳定前缀 + Prompt Cache**：systemPrompt、用户画像、指令记忆固定在前，动态内容在后 | 命中缓存后输入成本降一个量级 |
| 8 | **记忆检索而非全量注入**：FTS5 召回 top 3–5 条相关记忆 | 避免每次塞几千字画像 |
| 9 | **上下文裁剪**：对话只带最近 N 轮 + 历史摘要 | 长对话不再线性增长 |
| 10 | **事件合并**：同用户短时间多条事件合成一次调用 | 三次调用变一次 |
| 11 | **去重**：`event_uid` 幂等 + 内容哈希，重复内容不重复推理 | 杜绝重复计费 |
| 12 | **预算与降级**：每用户月度 token 配额，超限降级为纯规则模式并提示 | 成本可控，不会单用户失控 |

### 5.3 量化估算（估算值，随厂商定价浮动）

| 场景 | 处理方式 | 单次 token | 频次 | 说明 |
|---|---|---|---|---|
| 快递短信 | 正则命中 | 0 | 每天 1–3 条 | 约 85% 走此路径 |
| 快递短信（兜底） | 小模型抽取 | 输入 ~300 / 输出 ~80 | 少量 | 加 schema 约束 |
| 晨报 | 模板 | 0 | 每天 1 次 | — |
| 晚报 | 模板 + 统计 | 0 | 每天 1 次 | — |
| 单条提醒 | 模板 | 0 | 每天 2–5 次 | — |
| 助手对话 | 大模型 + 裁剪上下文 | 输入 ~1500 / 输出 ~300 | 每天 2–5 轮 | 命中缓存后输入成本大降 |
| 截图识别 | 端侧 OCR + 小模型 | 输入 ~400 / 输出 ~150 | 每天 0–2 次 | 不上传图片 |
| 收藏（链接） | 抓 OG 元数据 | 0 | 每天 0–3 条 | 不调模型 |
| 收藏（整理） | 小模型提取要点 | 输入 ~300 / 输出 ~80 | 用户主动触发 | 默认不自动整理 |
| 周回顾 | 模板 + 可选点评 | 0–300 | 每周 1 次 | — |

**月成本量级**：中等活跃用户（每天 3 轮对话 + 3 条短信识别）在 DeepSeek 档位下，**约为每月几毛到两元人民币**（估算）。订阅定价 ¥25–29/月有充足毛利空间。

### 5.4 成本监控

- 每条 LLM 调用记录：`user_id / model / input_tokens / output_tokens / cost`（`llm_calls` 表）
- 日报：总成本、人均成本、Top 消耗用户
- 告警：单用户日成本超阈 → 降级 + 提示

---

## 六、关键流程时序

### 6.1 短信 → 快递 Duty

```
[端] 短信到达
  → SmsModule 正则命中（0 成本）
  → 端侧生成 event_uid，POST /events（原文片段）
      ↓
[云] 写 events（去重）
  → 命中正则规则：直接 createDuty，不调 LLM
  → 未命中：调用小模型抽取 JSON
  → scheduleTimer（当天 18:00 提醒 / 次日 10:00 提醒）
      ↓
[云] cron 扫描到期 timer → 写 messages(kind='duty') + outbox
      ↓
[端] 点推送 → 打开助手 → 定位到这条消息 → 卡片上点"已取"
  → POST /duties/:id/complete
      ↓
[云] status=done → 后续 DAWN 跳过，不再提醒
```

### 6.2 晨报

```
[云] cron 每 30s 扫 users，命中 briefing_at（按用户时区）
  → 查当日 Duty（模板生成，0 token）
  → 同一事务写 messages(kind='briefing') + outbox
  → 推送 data: { messageId, kind: 'briefing' }
      ↓
[端] 点通知 → 打开助手，定位到这条消息
  → 清单卡上逐条勾选 / 全部完成 → 回传
```

### 6.3 助手对话（含截图）

```
[端] 用户发图
  → ML Kit OCR → 文本
  → POST /chat { text, sessionId }
      ↓
[云] 加载 session（最近 N 轮 + 摘要）+ FTS5 召回相关记忆
  → 拼装上下文（稳定前缀在前，利于缓存）
  → pi-agent-core 流式推理
  → 需要时调用 createDuty
  → SSE 流式返回 + 回写 session
      ↓
[端] 流式渲染；内嵌 Duty 确认卡
```

---

## 七、可靠性设计

| 问题 | 措施 |
|---|---|
| 端侧重复上报 | `event_uid` 唯一索引，`INSERT OR IGNORE` |
| 服务重启丢任务 | `events.status='processing'` 超时（2 min）自动重置为 `pending` |
| Agent 调用失败 | 重试 3 次，仍失败则降级为规则处理并记日志 |
| 推送失败 | 退避重试；最终失败则站内消息补展示 |
| 数据损坏 | 每日 `VACUUM INTO` 备份 + 异地同步（rsync/rclone） |
| 单机故障 | 备份恢复 + 文档化的重建流程（RTO 目标 1 小时内） |
| 用户误删 | Duty 软删除（`deleted_at`），保留 30 天 |

---

## 八、部署与运维

### 8.1 单机部署

```
一台 2C4G VPS（¥60–100/月）
├── Node 20 LTS + PM2（fork × 1）
├── /data/guanshi.db（SQLite，WAL）
├── Nginx 反代 + HTTPS（Let's Encrypt）
└── cron：每日 03:00 备份 - sqlite3 .backup + rclone 到对象存储
```

### 8.2 PM2 常用命令

```bash
pm2 start ecosystem.config.js
pm2 logs guanshi --lines 100
pm2 reload guanshi        # 平滑重启（会走优雅退出）
pm2 monit                 # 内存/CPU
pm2 save && pm2 startup   # 开机自启
```

### 8.3 备份策略

```bash
# 每日 03:00
sqlite3 /data/guanshi.db ".backup '/backup/guanshi-$(date +%F).db'"
find /backup -name '*.db' -mtime +14 -delete
rclone sync /backup remote:guanshi-backup
```

> 注意：不要直接 `cp` 正在使用的 SQLite 文件（可能不一致），必须用 `.backup` 或 `VACUUM INTO`。

### 8.4 容量预估

| 用户量 | 数据量（1 年） | 评估 |
|---|---|---|
| 1,000 | 约 200–500 MB | 单机轻松 |
| 10,000 | 约 2–5 GB | 单机可行，需关注写入延迟 |
| 50,000+ | 10 GB+ | 建议迁移 PostgreSQL 并拆分 worker |

---

## 九、里程碑技术拆解

### Phase 1（4 周）：云端骨架 + 每日仪式

| 周 | 交付 |
|---|---|
| W1 | Express 骨架 + SQLite schema + repositories 层 + PM2 配置；pi-agent-core 接入跑通 tool call |
| W2 | timers/scheduler/outbox/推送（FCM + 小米）；晨报晚报模板生成；通知 action 回执 |
| W3 | Expo prebuild 工程 + gluestack-ui 封装（Button/Card/Sheet/Toast）+ 今日视图 + Duty 详情 |
| W4 | 助手对话页（流式 SSE）+ 文字输入建 Duty + 周期 Duty 配置 + 联调验收 |

### Phase 2（4 周）：自动发现

| 周 | 交付 |
|---|---|
| W5 | SmsModule（Kotlin ContentObserver + 正则）；端侧上报链路 |
| W6 | WorkManager 周期拉活 + 短信历史补采；BootReceiver |
| W7 | OcrModule + 截图分享入口；ShareModule（ACTION_SEND）+ 收藏页与详情；小模型抽取 pipeline（JSON schema + 预算） |
| W8 | NlsModule；待确认区 UI；识别置信度与反馈学习；周日收藏回顾 + 转成待办 |

### Phase 3（4 周）：主动推进与记忆

| 周 | 交付 |
|---|---|
| W9 | DAWN 完整打分（UserContext + 自适应阈值 + 批量合并） |
| W10 | 记忆三层 + FTS5 召回 + 注入策略 |
| W11 | 升级/降级话术；周回顾报告；token 成本监控看板 |
| W12 | 保活引导 + 推送到达率优化 + 压测 |

---

## 十、风险与技术对策

| 风险 | 等级 | 对策 |
|---|---|---|
| **杀 App 导致采集中断** | 高 | WorkManager 拉活 + 短信历史补采 + 推送透传 + 保活引导；通知类明确告知可能漏 |
| **SQLite 写入成为瓶颈** | 中 | 单进程串行 + 批量限流；监控写延迟；预留 PG 迁移路径 |
| **单机单点故障** | 中 | 每日备份 + 异地同步 + 快速重建脚本 |
| **PM2 不能水平扩展** | 中 | 明确 MVP 定位为验证期；扩容即迁 PG + 拆进程 |
| **国内推送通道碎片化** | 高 | FCM + 小米先行，按设备分布补齐；本地 AlarmManager 兜底 |
| **讯飞 SDK 授权与包体** | 中 | 在线听写为主；离线包按需；封装层隔离，可替换 |
| **LLM 成本随对话量增长** | 中 | §5 十二条措施 + 月度配额 + 降级 |
| **SMS 权限审核** | 中 | 国内市场为主，明确"快递取件助理"用途 |

---

## 十一、技术选型速查

| 层 | 选型 |
|---|---|
| 端侧框架 | Expo prebuild + React Native + TypeScript |
| 端侧 UI | gluestack-ui v4+（shadcn 风格）+ NativeWind |
| 端侧语音 | 讯飞语音听写 IAT |
| 端侧 OCR | ML Kit Text Recognition |
| 端侧存储 | expo-sqlite + MMKV |
| 端侧后台 | WorkManager + AlarmManager + BootReceiver |
| 云端运行时 | Node.js 20 + Express |
| 云端进程管理 | PM2（fork × 1） |
| 云端数据库 | SQLite（better-sqlite3，WAL，FTS5） |
| 云端调度 | node-cron + SQLite timers/events 表（无 Redis） |
| Agent | @earendil-works/pi-agent-core |
| 推送 | FCM + 小米/华为/OPPO/vivo |
| 部署 | 单台 2C4G VPS + Nginx + Let's Encrypt |

---

*配套产品方案见 [product-plan.md](./product-plan.md)*
