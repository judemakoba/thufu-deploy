module.exports = {
  apps: [{
    name: 'thufu-backend',
    script: 'dist/index.js',
    cwd: '/root/thufu-deploy/backend',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      DATABASE_URL: 'sqlite:./data/thufu_deploy.db',
      HOST: '0.0.0.0',
      PORT: '3001'
    }
  }]
};
