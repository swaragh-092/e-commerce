require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

module.exports = {
    development: {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'ecommerce_dev',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        dialect: 'postgres',
        logging: console.log,
        define: {
            timestamps: true,
            underscored: true,
        },
    },
    test: {
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
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
            acquire: 60000,
            idle: 10000,
        },
    },
};
