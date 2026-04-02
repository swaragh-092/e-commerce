'use strict';

require('dotenv').config();
const path = require('path');
const app = require('./src/app');
const { sequelize } = require('./src/config/database');
const logger = require('./src/utils/logger');
// Trigger association setup
require('./src/modules');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Authenticate with DB
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');

    // We do NOT sync database here; we depend on migrations.
    
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
