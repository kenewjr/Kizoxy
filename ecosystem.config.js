module.exports = {
  apps: [
    {
      name: "kizoxy",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        LOG_FORMAT: "json",
      },
      env_development: {
        NODE_ENV: "development",
        LOG_FORMAT: "pretty",
      },
      // PM2 log config
      error_file: "./logs/kizoxy-error.log",
      out_file: "./logs/kizoxy-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Restart policy
      exp_backoff_restart_delay: 1000,
      max_restarts: 20,
      min_uptime: "10s",
    },
  ],
};
