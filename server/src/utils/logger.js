'use strict';

const winston = require('winston');

// Determine log level based on environment
const level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

// Configure formats
const formats = [
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
];

if (process.env.NODE_ENV !== 'production') {
  // Pretty-print to console in dev
  formats.pop(); 
  formats.push(winston.format.colorize());
  formats.push(winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${message}${stack ? `\n${stack}` : ''}`;
  }));
}

const logger = winston.createLogger({
  level,
  format: winston.format.combine(...formats),
  transports: [
    new winston.transports.Console()
  ],
});

module.exports = logger;
