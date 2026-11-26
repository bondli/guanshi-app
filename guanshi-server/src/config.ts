import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 服务端配置放在 ~/.guanshi-app/config.json，首次启动自动生成 */
const configDir = process.env.GUANSHI_CONFIG_DIR || path.join(os.homedir(), '.guanshi-app')
const configPath = path.join(configDir, 'config.json')

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
}

const defaults: FileConfig = {
  port: 7777,
  host: '0.0.0.0',
  timezone: 'Asia/Shanghai',
  dataDir: path.join(configDir, 'data'),
  publicBaseUrl: 'http://localhost:7777',
  llmRateLimitPerMinute: 20,
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
const merged: FileConfig = { ...defaults, ...file }

fs.mkdirSync(merged.dataDir, { recursive: true })

export const config = {
  ...merged,
  configDir,
  configPath,
  dbPath: path.join(merged.dataDir, 'guanshi.db'),
  keyDir: path.join(configDir, 'keys'),
}
