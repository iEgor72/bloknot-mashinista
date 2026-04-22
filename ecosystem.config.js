module.exports = {
  apps: [
    {
      name: 'bloknot-mashinista',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        BM_ADMIN_TELEGRAM_IDS: '906498745',
      },
    },
  ],
};
