# 管事 GuanShi

> 你的事，我来管。

一个常驻云端的个人生活管家：短信、通知、截图、分享进来的零碎信息自动变成待办，助手负责理解与安排，到点主动提醒。

- 客户端：Android App（Expo prebuild + React Native，Kotlin 原生模块）
- 服务端：Node.js（Express + SQLite），负责 Agent、定时调度、推送与节日日历

## 功能

| 模块 | 说明 |
|---|---|
| 今日 | 今日待办、完成进度、晨报/复盘入口、语音与截图快速收集 |
| 清单 | 列表与日历双视图；日历标记公历节日、农历节日、二十四节气、法定休假与调休 |
| 助手 | 自然语言建/改/查待办、写记忆；OpenAI 兼容的 function calling，无模型 Key 时走规则兜底 |
| 收藏 | 链接、图片、文字收藏；微信 / 抖音 / 小红书「复制链接」回到 App 自动识别 |
| 我的 | 模型 Key、讯飞语音、免打扰、家人与长期记忆、保活设置、数据与隐私 |

## 目录结构

```
guanshi-app/
├── guanshi-client/          Android 客户端
│   ├── app/                 expo-router 页面（tabs、详情、设置、首次引导）
│   ├── src/                 状态管理、API、主题、UI 组件、原生桥接
│   ├── native/android/      自定义原生模块（OCR、语音、分享、短信、通知监听、加密、剪贴板）
│   ├── plugins/             config plugin：注入权限、intent-filter、原生源码
│   ├── scripts/build-apk.mjs  release 打包脚本
│   └── assets/              图标与启动图
├── guanshi-server/          云端服务
│   └── src/                 agent / 调度 / 仓储 / 推送 / 节日 / 加密
├── docs/                    产品方案、技术设计、流程图
└── demo/                    早期静态 demo
```

## 技术栈

- 客户端：Expo SDK 58、React Native 0.88、TypeScript、expo-router、zustand、expo-notifications、react-native-svg、lucide-react-native
- 服务端：Node.js 20+、Express 4、better-sqlite3（WAL）、tsx、ws、lunar-javascript
- 原生：Kotlin（OCR 用 ML Kit，语音用系统识别/讯飞，其余能力自研，不依赖第三方推送 SDK）

## 快速开始

### 1. 启动服务端

```bash
cd guanshi-server
npm install
npm run dev          # http://localhost:8787
```

首次启动自动创建 `~/.guanshi-app/`（配置、数据库、RSA 密钥）。

### 2. 准备 Android 模拟器

```bash
emulator -avd <你的 AVD>
adb reverse tcp:8787 tcp:8787
```

客户端默认连 `http://10.0.2.2:8787/api`，`adb reverse` 后也可用 `localhost`。

### 3. 运行客户端

```bash
cd guanshi-client
npm install
npm run android      # 构建并安装到已连接的设备/模拟器
npx expo start       # 只起 Metro
```

真机调试：在「我的 → 云端模型 → 服务端地址」填 `http://<电脑局域网IP>:8787/api`。

### 4. 打安装包

```bash
cd guanshi-client
npm run pack              # expo prebuild（同步 native/ 下的 Kotlin）+ assembleRelease
node scripts/build-apk.mjs # 原生代码没变时，只重打 JS 包
```

产物（按 ABI 拆包，只打 arm64-v8a，一个包只带一套 so）：

| 文件 | 用途 | 体积 |
|---|---|---|
| `guanshi-client/dist/guanshi-<version>.apk` | arm64-v8a，真机（含华为 Mate 60 系列）与 Apple Silicon 模拟器 | 约 53 MB |

- 版本号来自 `guanshi-client/app.json` 的 `expo.version`，页面底部显示的就是它
- 需要 JDK 17（默认 `/opt/homebrew/opt/openjdk@17`，可用 `JAVA_HOME` 覆盖）与 Android SDK（minSdk 24、targetSdk 36）
- `build-apk.mjs` 会先清理 Gradle 的 JS bundle 产物，避免改完代码打出旧包
- 包体大头是原生 so 与 dex：合并全 ABI 的通用包约 146 MB，拆包后只剩 arm64 的 53 MB；R8 当前关闭（见 `plugins/withGuanshiNative.js` 注释），开启后可再瘦身约 10 MB
- 如果要在 Intel Mac 的 x86 模拟器上跑，在 `plugins/withGuanshiNative.js` 的 `splits` 与 `reactNativeArchitectures` 里加上 `x86_64` 即可

### 类型检查

```bash
cd guanshi-server && npm run typecheck
cd guanshi-client && npm run typecheck
```

## 配置与数据

| 路径 | 说明 |
|---|---|
| `~/.guanshi-app/config.json` | 服务端配置（端口、时区等） |
| `~/.guanshi-app/data/guanshi.db` | SQLite 数据库（WAL 模式） |
| `~/.guanshi-app/keys/` | RSA-2048 密钥对，用于传输加密 |

不使用 `.env`。模型 Key、讯飞 Key 都只在手机端填写，加密后随请求上送，服务端不落库；服务端只做内存解密。

## 关键设计

- **身份**：首启生成 `deviceId`（AsyncStorage）→ `POST /api/auth/login` → `token = user.id`（SecureStore）→ 之后所有请求带 `Authorization: Bearer <token>`。没有账号密码，卸载重装即换新身份。
- **传输加密**：`GET /api/crypto/public-key` 拿公钥，客户端 Kotlin 侧 RSA-OAEP(SHA-256) 加密敏感字段，与 Node 的 `oaepHash: 'sha256'` 对齐。
- **消息与推送同源**：先写 `messages`，再写 `outbox`（带 `messageId`）。前台通过 WebSocket（`/api/stream`）即时下发，客户端弹本地通知；点通知按 `messageId` 回到 `/chat` 高亮同一条。免打扰只跳过投递，消息仍留在助手。
- **节日日历**：`lunar-javascript` 本地计算公历/农历节日与 24 节气，`HolidayUtil` 提供法定休假与调休；每天一次幂等生成未来一年的节日待办与提前提醒，用户删掉的不会重建。
- **收藏来源**：剪贴板识别 `mp.weixin.qq.com`、`v.douyin.com`、`xhslink.cn|com`，标题直接从句式里解析。详情页「打开原链接」= 把原始分享文本写回剪贴板 + 按包名拉起对应 App，让 App 自己识别口令。

## 主要接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 设备登录，返回 token 与用户 |
| GET | `/api/bootstrap` | 启动数据（用户、待办、消息、收藏、记忆、家人、节日） |
| GET/POST | `/api/duties` | 待办列表 / 新建 |
| PATCH/DELETE | `/api/duties/:id` | 修改状态、时间 / 删除 |
| POST | `/api/chat` | 助手对话（可携带加密的模型配置） |
| GET/POST | `/api/collections` | 收藏列表 / 新建 |
| PATCH/DELETE | `/api/collections/:id` | 更新 / 删除 |
| GET/POST | `/api/memories`、`/api/family` | 记忆与家人 |
| PATCH | `/api/me/settings` | 晨报、复盘、免打扰、提醒风格 |
| POST | `/api/push/test` | 触发一次晨报或复盘 |
| WS | `/api/stream?token=` | 前台即时通道 |

## 已知限制

- **厂商推送未接**：App 进程被杀后收不到提醒。`services.ts` 的 `deliver()` 里留了接入位置与说明（个推 / FCM）。
- **微信没有系统分享入口**：只能「复制链接」后回到 App，由剪贴板识别兜底；抖音、小红书同理。
- **HarmonyOS NEXT 不能安装 APK**，只能用兼容层；华为纯净模式「增强防护」也会拦截侧载安装。
- **调休数据随依赖版本**：`lunar-javascript` 内置国务院公告数据，跨年后需升级依赖。
- **单机单进程**：无 Redis、无队列，适合个人或小范围使用。

## 文档

- [技术设计](docs/technical-design.md)
- [产品方案](docs/product-plan.md)
- [产品简报（HTML）](docs/product-brief.html)
- [身份与鉴权流程图](docs/auth-flow.html)
- [推送链路流程图](docs/push-flow.html)
