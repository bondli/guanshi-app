import express from 'express'
import cors from 'cors'
import { config } from './config'
import { closeDb } from './db'
import router from './routes'
import { flushPendingToUser, startScheduler, stopScheduler } from './services'
import { attachStream, stopStream } from './stream'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/', (_req, res) => {
  res.json({
    name: '管事 GuanShi',
    version: '0.1.0',
    docs: 'GET /api/health',
  })
})

app.use('/api', router)

app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

const server = app.listen(config.port, config.host, () => {
  console.log(`[guanshi] http://localhost:${config.port}  (${config.timezone})`)
  console.log(`[guanshi] 配置文件 ${config.configPath}`)
  console.log(`[guanshi] 数据目录 ${config.dataDir}`)
  console.log('[guanshi] 模型 Key 由客户端随请求上送（RSA-OAEP 加密），服务端不保存')
  attachStream(server, flushPendingToUser)
  startScheduler()
})

function shutdown(signal: string): void {
  console.log(`[guanshi] ${signal}，正在退出…`)
  stopScheduler()
  stopStream()
  server.close(() => {
    closeDb()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (reason) => {
  console.warn('[guanshi] unhandled rejection', reason)
})
