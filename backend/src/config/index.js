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
  },
  razorpayKeyId: env.RAZORPAY_KEY_ID,
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET,
};

module.exports = config;
