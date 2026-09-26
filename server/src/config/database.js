const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from process cwd, server/.env, and root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = {
    development: {
        username: process.env.DB_USER || 'postgres',
        // Do not silently fall back to a known database password. Local
        // development should provide DB_PASSWORD explicitly (or fail with a
        // useful database authentication error).
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ecommerce',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        dialect: 'postgres',
        logging: console.log,
        define: {
            timestamps: true,
            underscored: true,
        },
        pool: {
            max: 10,
            min: 2,
            acquire: 30000,
            idle: 10000,
            evict: 10000,
            validate: (client) => {
                return client.query('SELECT 1').then(() => true).catch(() => false);
            },
        },
        dialectOptions: {
            options: '-c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000',
            keepalive: true,
            keepaliveInitialDelayMillis: 10000,
        },
    },
    test: {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME ? `${process.env.DB_NAME}_test` : 'ecommerce_test',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        dialect: 'postgres',
        logging: false,
        define: {
            timestamps: true,
            underscored: true,
        },
    },
    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        dialect: 'postgres',
        logging: false,
        define: {
            timestamps: true,
            underscored: true,
        },
        pool: {
            max: 20,
            min: 5,
            acquire: 30000,
            idle: 10000,
            evict: 10000,
            validate: (client) => {
                return client.query('SELECT 1').then(() => true).catch(() => false);
            },
        },
        dialectOptions: {
            options: '-c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000',
            keepalive: true,
            keepaliveInitialDelayMillis: 10000,
        },
    },
};

// For local containers, use docker-compose.yml with DB_PASSWORD supplied by
// an untracked .env file. Never commit database credentials in this module.
