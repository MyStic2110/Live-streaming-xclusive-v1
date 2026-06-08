import pino from 'pino';

// Configure log level
const logLevel = process.env.LOG_LEVEL || 'info';

// Configure Pino Logger for high-throughput enterprise performance
const logger = pino({
  level: logLevel,
  base: {
    service: 'backend-server',
    env: process.env.NODE_ENV || 'development'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export default logger;
