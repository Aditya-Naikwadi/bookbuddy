// Centralized environment and configuration manager.
const env = require('./env');

const config = {
  port: env.PORT,
  host: env.HOST,
  mongoUri: env.MONGO_URI,
  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
    issuer: env.JWT_ISSUER || 'bookbuddy-api',
    audience: env.JWT_AUDIENCE || 'bookbuddy-client',
  },
  clientOrigin: env.CLIENT_ORIGIN,
  nodeEnv: env.NODE_ENV,
  loanPeriodDays: env.LOAN_PERIOD_DAYS,
  maxRenewals: env.MAX_RENEWALS,
  unpaidFineLimit: env.UNPAID_FINE_LIMIT,
  fineRatePerDay: env.FINE_RATE_PER_DAY,
  fineMaxAmount: env.FINE_MAX_AMOUNT,
  holdPickupWindowHours: env.HOLD_PICKUP_WINDOW_HOURS,
  dueReminderDaysBefore: env.DUE_REMINDER_DAYS_BEFORE,
  streakReminderHoursBefore: env.STREAK_REMINDER_HOURS_BEFORE,
  labOperatingHours: {
    startHour: env.LAB_START_HOUR,
    endHour: env.LAB_END_HOUR,
  },
  redisUrl: env.REDIS_URL,
  rateLimits: {
    globalMax: env.RATE_LIMIT_GLOBAL_MAX,
    globalWindowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
    authMax: env.RATE_LIMIT_AUTH_MAX,
    authIpMax: env.RATE_LIMIT_AUTH_IP_MAX,
    authEmailMax: env.RATE_LIMIT_AUTH_EMAIL_MAX,
    authWindowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
    userMax: env.RATE_LIMIT_USER_MAX,
    userWindowMs: env.RATE_LIMIT_USER_WINDOW_MS,
    expensiveMax: env.RATE_LIMIT_EXPENSIVE_MAX,
    expensiveWindowMs: env.RATE_LIMIT_EXPENSIVE_WINDOW_MS,
    searchMax: env.RATE_LIMIT_SEARCH_MAX,
    searchWindowMs: env.RATE_LIMIT_SEARCH_WINDOW_MS,
    patronCardVerifyMax: env.RATE_LIMIT_PATRON_CARD_VERIFY_MAX,
    patronCardVerifyWindowMs: env.RATE_LIMIT_PATRON_CARD_VERIFY_WINDOW_MS,
  },
  loginLockout: {
    maxAttempts: env.LOGIN_LOCKOUT_MAX_ATTEMPTS,
    durationS: env.LOGIN_LOCKOUT_DURATION_S,
    windowS: env.LOGIN_LOCKOUT_WINDOW_S,
  },
  trustProxyHops: env.TRUST_PROXY_HOPS !== undefined ? env.TRUST_PROXY_HOPS : 1,
  socketIoRedisAdapterEnabled:
    env.SOCKET_IO_REDIS_ADAPTER_ENABLED !== undefined ? env.SOCKET_IO_REDIS_ADAPTER_ENABLED : true,
  enableCron: env.ENABLE_CRON !== undefined ? env.ENABLE_CRON : true,
  timezoneAwareCronEnabled:
    env.TIMEZONE_AWARE_CRON_ENABLED !== undefined ? env.TIMEZONE_AWARE_CRON_ENABLED : true,
  trustProxy: (() => {
    const val = env.TRUST_PROXY;
    if (val === true || val === 'true') return true;
    if (val === false || val === 'false' || val === undefined || val === null || val === '')
      return false;
    if (!isNaN(Number(val))) return Number(val);
    return val;
  })(),
  scannerApiKey: env.SCANNER_API_KEY,
  razorpayKeyId: env.RAZORPAY_KEY_ID,
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET,
  healthCheckToken: env.HEALTH_CHECK_TOKEN || null,
  trustedProxies: env.TRUSTED_PROXIES ? env.TRUSTED_PROXIES.split(',').map((p) => p.trim()) : [],
  additionalCorsOrigins: env.ADDITIONAL_CORS_ORIGINS
    ? env.ADDITIONAL_CORS_ORIGINS.split(',').map((o) => o.trim())
    : [],
  storage: {
    provider: env.STORAGE_PROVIDER || (env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'local'),
    signingSecret: env.STORAGE_SIGNING_SECRET || env.JWT_SECRET || 'bookbuddy-storage-secret',
    localDir: env.STORAGE_LOCAL_DIR || null,
    maxEbookSizeBytes: env.MAX_EBOOK_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024,
    maxRosterSizeBytes: env.MAX_ROSTER_UPLOAD_SIZE_BYTES || 20 * 1024 * 1024,
  },
};

module.exports = config;
