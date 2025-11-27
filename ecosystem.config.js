/**
 * PM2 Ecosystem Configuration
 * Configuration for running Astibot in production with PM2 process manager
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
    apps: [{
        name: 'astibot',
        script: './server.js',
        instances: 1,
        exec_mode: 'fork', // Use fork mode to maintain single trading state
        autorestart: true,
        watch: false,
        max_memory_restart: '500M', // Restart if memory exceeds 500MB (good for Raspberry Pi)
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        min_uptime: '10s',
        max_restarts: 10,
        restart_delay: 4000,
        kill_timeout: 5000,
        wait_ready: true,
        listen_timeout: 10000
    }]
};
