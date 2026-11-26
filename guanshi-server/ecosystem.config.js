// PM2 配置：SQLite 单写者，必须 fork × 1，不能用 cluster
module.exports = {
  apps: [
    {
      name: 'guanshi-server',
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '600M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Shanghai',
      },
    },
  ],
}
