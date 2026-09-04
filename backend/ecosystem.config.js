module.exports = {
  apps: [
    {
      name: 'bookbuddy-backend',
      script: './src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      min_uptime: '5000',
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
