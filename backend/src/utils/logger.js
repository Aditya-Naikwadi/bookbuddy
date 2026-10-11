// Dependency-free structured logger supporting key-based redaction, PII masking, log injection prevention, and levels.
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

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'pwd',
  'pass',
  'secret',
  'token',
  'bearer',
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'card',
  'cvv',
  'cvc',
  'pan',
  'ssn',
  'otp',
  'mfacode',
  'code',
  'salt',
  'hash',
  'privatekey',
  'private_key',
  'rawbody',
];

const isSensitiveKey = (key) => {
  if (!key || typeof key !== 'string') return false;
  const lower = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_KEY_PATTERNS.some((pattern) => {
    const cleanPattern = pattern.replace(/[-_]/g, '');
    return lower === cleanPattern || lower.includes(cleanPattern);
  });
};

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  // 1. Neutralize log injection: replace newlines / carriage returns with space
  let sanitized = str.replace(/[\r\n]+/g, ' ');

  // 2. Redact JWT tokens
  sanitized = sanitized.replace(
    /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
    '[REDACTED_JWT]'
  );

  // 3. Redact Authorization Bearer headers
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]');

  // 4. Redact sensitive query parameters in URLs
  sanitized = sanitized.replace(
    /(?:password|token|secret|key|apiKey|code|otp)=[^&\s]+/gi,
    (match) => `${match.split('=')[0]}=[REDACTED]`
  );

  // 5. Redact credit card numbers (13-19 digits, optionally spaced or hyphenated)
  sanitized = sanitized.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[REDACTED_CARD]');

  // 6. Mask email addresses: user@domain.com -> u***@domain.com
  sanitized = sanitized.replace(
    /\b([A-Za-z0-9])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
    '$1***$2'
  );

  return sanitized;
};

const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  return sanitizeString(url);
};

const sanitizeValue = (value, parentKey = '', seen = new WeakSet()) => {
  if (value === null || value === undefined) {
    return value;
  }

  // Key-based redaction: immediately redact value if key is sensitive
  if (parentKey && isSensitiveKey(parentKey)) {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      ...(value.stack && { stack: sanitizeString(value.stack) }),
    };
  }

  if (typeof value === 'object') {
    // Prevent infinite recursion on circular objects
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, parentKey, seen));
    }

    const cleaned = {};
    for (const [k, v] of Object.entries(value)) {
      cleaned[k] = isSensitiveKey(k) ? '[REDACTED]' : sanitizeValue(v, k, seen);
    }
    return cleaned;
  }

  return value;
};

const formatLog = (level, message, meta) => {
  const cleanMessage = sanitizeString(String(message || ''));
  const cleanMeta = meta ? sanitizeValue(meta) : undefined;

  const logObj = {
    timestamp: new Date().toISOString(),
    level: LEVEL_NAMES[level],
    instanceId,
    hostname,
    message: cleanMessage,
    ...(cleanMeta && { meta: cleanMeta }),
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
  const metaStr = cleanMeta ? ` ${JSON.stringify(cleanMeta)}` : '';
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
  sanitizeString,
  sanitizeUrl,
  sanitizeValue,
  isSensitiveKey,
};

module.exports = logger;
