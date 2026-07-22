// PM2 process definitions — run: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'exhibitor-api',
      script: 'dist/server.js',
      instances: 'max', // one per CPU core (cluster mode)
      exec_mode: 'cluster',
      max_memory_restart: '600M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'exhibitor-worker',
      script: 'dist/worker.js',
      instances: 1, // queue workers; scale concurrency inside BullMQ
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
