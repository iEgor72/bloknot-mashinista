module.exports = {
  apps: [
    {
      name: 'master-bot-hub',
      cwd: '/opt/master-bot-hub/services/master-bot-hub',
      script: 'src/server.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      }
    },
    {
      name: 'master-bot-hub-worker',
      cwd: '/opt/master-bot-hub/services/master-bot-hub',
      script: 'src/worker.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
