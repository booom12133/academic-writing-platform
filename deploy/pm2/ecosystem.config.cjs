'use strict';

module.exports = {
  apps: [
    {
      name: 'academic-writing-platform',
      cwd: '/opt/academic-writing-platform/current/app',
      script: 'server/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 10000,
      listen_timeout: 10000,
      max_memory_restart: '700M',
      node_args: '--env-file=/etc/academic-writing-platform/production.env',
      env: {
        NODE_ENV: 'production',
        RUNTIME_PROFILE: 'standalone',
        SERVER_HOST: '127.0.0.1',
        SERVER_PORT: '3000',
      },
      output: '/var/log/academic-writing-platform/pm2-out.log',
      error: '/var/log/academic-writing-platform/pm2-error.log',
      time: true,
      merge_logs: true,
    },
  ],
};
