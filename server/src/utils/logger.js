// Dependency-free structured logger supporting levels and environments.
const config = require('../config');

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

const currentLevel = config.nodeEnv === 'production' ? LEVELS.info : LEVELS.debug;

const instanceId = process.env.INSTANCE_ID || process.env.PM2_ID || `pid-${process.pid}`;
const os = require('os');
const hostname = os.hostname();

const formatLog = (level, message, meta) => {
  const logObj = {
    timestamp: new Date().toISOString(),
    level: LEVEL_NAMES[level],
    instanceId,
    hostname,
    message,
    ...(meta && { meta }),
  };

  if (config.nodeEnv === 'production') {
    return JSON.stringify(logObj);
  }

  // Pretty print in development
  const colors = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m', // Green
    WARN: '\x1b[33m', // Yellow
    ERROR: '\x1b[31m', // Red
    RESET: '\x1b[0m',
  };

  const color = colors[logObj.level] || '';
  const reset = colors.RESET;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${logObj.timestamp}] ${color}${logObj.level}${reset}: ${logObj.message}${metaStr}`;
};

const logger = {
  debug: (msg, meta) => {
    if (currentLevel <= LEVELS.debug) {
      // eslint-disable-next-line no-console
      console.debug(formatLog(LEVELS.debug, msg, meta));
    }
  },
  info: (msg, meta) => {
    if (currentLevel <= LEVELS.info) {
      // eslint-disable-next-line no-console
      console.info(formatLog(LEVELS.info, msg, meta));
    }
  },
  warn: (msg, meta) => {
    if (currentLevel <= LEVELS.warn) {
      // eslint-disable-next-line no-console
      console.warn(formatLog(LEVELS.warn, msg, meta));
    }
  },
  error: (msg, meta) => {
    if (currentLevel <= LEVELS.error) {
      // eslint-disable-next-line no-console
      console.error(formatLog(LEVELS.error, msg, meta));
    }
  },
};

module.exports = logger;
