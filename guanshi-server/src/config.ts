import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 服务端配置放在 ~/.guanshi-app/config.json，首次启动自动生成 */
const configDir = process.env.GUANSHI_CONFIG_DIR || path.join(os.homedir(), '.guanshi-app')
const configPath = path.join(configDir, 'config.json')

export interface HuaweiPushConfig {
  /** AGC 里的 Client ID（和 APP ID 相同） */
  clientId: string
  clientSecret: string
  /** 自分类权益通过前先用测试消息，可豁免每日单设备频控 */
  testMessage: boolean
  /** 自分类权益通过后填 WORK（工作事项提醒）；未通过时填了也会被归为资讯营销 */
  category: string
}

export interface FileConfig {
  port: number
  host: string
  timezone: string
  /** 数据目录，SQLite 与日志都在这里 */
  dataDir: string
  /** 对外地址，仅用于日志与深链拼接 */
  publicBaseUrl: string
  /** 单个用户每分钟最多调用多少次模型 */
  llmRateLimitPerMinute: number
  /** 华为推送，来自 AGC「项目设置 > 常规」 */
  huawei: HuaweiPushConfig
}

const defaults: FileConfig = {
  port: 7777,
  host: '0.0.0.0',
  timezone: 'Asia/Shanghai',
  dataDir: path.join(configDir, 'data'),
  publicBaseUrl: 'http://localhost:7777',
  llmRateLimitPerMinute: 20,
  huawei: {
    clientId: '',
    clientSecret: '',
    testMessage: true,
    category: 'WORK',
  },
}

function readFile(): Partial<FileConfig> {
  try {
    if (!fs.existsSync(configPath)) return {}
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<FileConfig>
  } catch (error) {
    console.warn(`[config] 读取 ${configPath} 失败，使用默认配置：${(error as Error).message}`)
    return {}
  }
}

function ensureFile(): void {
  try {
    fs.mkdirSync(configDir, { recursive: true })
    if (fs.existsSync(configPath)) return
    fs.writeFileSync(configPath, `${JSON.stringify(defaults, null, 2)}\n`, 'utf8')
    console.log(`[config] 已生成默认配置：${configPath}`)
  } catch (error) {
    console.warn(`[config] 无法写入 ${configPath}：${(error as Error).message}`)
  }
}

ensureFile()

const file = readFile()
const merged: FileConfig = {
  ...defaults,
  ...file,
  // 逐项合并，避免配置文件里只写了一部分 huawei 字段时把默认值整块覆盖
  huawei: { ...defaults.huawei, ...(file.huawei ?? {}) },
}

fs.mkdirSync(merged.dataDir, { recursive: true })

export const config = {
  ...merged,
  configDir,
  configPath,
  dbPath: path.join(merged.dataDir, 'guanshi.db'),
  keyDir: path.join(configDir, 'keys'),
}
