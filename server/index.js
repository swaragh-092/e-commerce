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

const startServer = async () => {
  try {
    // Authenticate with DB
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');

    // We do NOT sync database here; we depend on migrations.
    
    // Start background jobs
    startJobs();

    
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
