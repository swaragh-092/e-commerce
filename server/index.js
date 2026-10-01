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
let server = null;
let isShuttingDown = false;

// Graceful shutdown
const shutdown = async (signal, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received. Starting shutdown...`);
  if (poolStatsInterval) clearInterval(poolStatsInterval);

  // Force close after 10s if graceful shutdown hangs
  const forceExit = setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(exitCode || 1);
  }, 10000);
  if (forceExit.unref) forceExit.unref();

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await sequelize.close();
        logger.info('Database connection closed.');
        process.exit(exitCode);
      } catch (err) {
        logger.error('Error during database shutdown:', err);
        process.exit(1);
      }
    });
  } else {
    try {
      await sequelize.close();
      logger.info('Database connection closed.');
    } catch (err) {
      logger.error('Error during database shutdown:', err);
    }
    process.exit(exitCode);
  }
};

// Crash safely: log async failures outside try/catch instead of dying silently.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  shutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGINT', () => shutdown('SIGINT', 0));

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
    
    server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
