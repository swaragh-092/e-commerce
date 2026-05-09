'use strict';

const fs = require('fs');
const path = require('path');
const rootEnv = path.join(__dirname, '../.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config();
}
const app = require('./src/app');
const { sequelize } = require('./src/modules');
const logger = require('./src/utils/logger');
const startJobs = require('./src/jobs');
const { validateEnvironment } = require('./src/utils/validateEnvironment');

// Fail fast — verify secrets before touching the DB or network
validateEnvironment();


const PORT = process.env.PORT || 5000;
let poolStatsInterval = null;

const startServer = async () => {
  try {
    // Authenticate with DB
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');

    const poolCfg = sequelize.config.pool;
    logger.info(`DB pool config: max=${poolCfg.max} min=${poolCfg.min} acquire=${poolCfg.acquire}ms idle=${poolCfg.idle}ms`);

    // We do NOT sync database here; we depend on migrations.
    
    // Start background jobs
    startJobs();

    // Ensure storage directories exist if using local storage
    const { getStorageProvider } = require('./src/utils/storage');
    const storage = getStorageProvider();
    if (typeof storage.ensureDirs === 'function') {
      await storage.ensureDirs();
    }

    // Log pool stats periodically in production
    const logPoolStats = () => {
      try {
        const pool = sequelize.connectionManager?.pool;
        if (pool) {
          logger.info('DB Pool Stats', {
            size: typeof pool.size === 'number' ? pool.size : 0,
            available: typeof pool.available === 'number' ? pool.available : 0,
            pending: typeof pool.pending === 'number' ? pool.pending : 0,
            borrowed: typeof pool.borrowed === 'number' ? pool.borrowed : 0
          });
        }
      } catch (err) {}
    };

    // Log immediately on startup
    logPoolStats();

    if (process.env.NODE_ENV === 'production') {
      poolStatsInterval = setInterval(logPoolStats, 60000);
    }
    
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      if (poolStatsInterval) clearInterval(poolStatsInterval);
      
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await sequelize.close();
          logger.info('Database connection closed.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during database shutdown:', err);
          process.exit(1);
        }
      });

      // Force close after 10s
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
