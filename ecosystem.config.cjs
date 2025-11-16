module.exports = {
  apps: [
    {
      name: 'boundless-backend',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8800
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8800
      },  
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto restart settings
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',

      // Advanced settings
      min_uptime: '10s',
      max_restarts: 10,
      
      // Health monitoring
      health_check_grace_period: 3000,
      
      // Environment variables
      env_file: '.env'
    }
  ],

  deploy: {
    production: {
      user: 'bound-api',
      host: '46.202.195.31',
      ref: 'origin/main',
      repo: 'git@github.com:0xdevcollins/boundless-backend.git',
      path: '/home/bound-api/htdocs/api.boundlessfi.xyz',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.cjs --env production'
    }
  }
};
