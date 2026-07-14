// Centralized environment and configuration manager.
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from relative path
dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnv = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRY',
  'JWT_REFRESH_EXPIRY',
  'CLIENT_ORIGIN',
  'NODE_ENV',
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  throw new Error(
    `❌ Fatal Startup Error: Missing required environment variables: [${missingEnv.join(', ')}]. Please check your .env file.`
  );
}

if (process.env.NODE_ENV === 'production') {
  const weakSecrets = ['supersecret123', 'supersecretrefresh123', 'placeholder', 'secret', 'default', 'testjwtsecretkey999', 'testjwtrefreshsecretkey999'];
  if (
    weakSecrets.includes(process.env.JWT_SECRET.toLowerCase()) ||
    weakSecrets.includes(process.env.JWT_REFRESH_SECRET.toLowerCase())
  ) {
    throw new Error(
      `❌ Fatal Startup Error: JWT_SECRET or JWT_REFRESH_SECRET is set to a weak placeholder/default value in production environment.`
    );
  }
}

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY,
  },
  clientOrigin: process.env.CLIENT_ORIGIN,
  nodeEnv: process.env.NODE_ENV,
  loanPeriodDays: parseInt(process.env.LOAN_PERIOD_DAYS, 10) || 14,
  maxRenewals: parseInt(process.env.MAX_RENEWALS, 10) || 2,
  unpaidFineLimit: parseInt(process.env.UNPAID_FINE_LIMIT, 10) || 100,
  fineRatePerDay: parseInt(process.env.FINE_RATE_PER_DAY, 10) || 5,
  fineMaxAmount: parseInt(process.env.FINE_MAX_AMOUNT, 10) || 100,
  holdPickupWindowHours: parseInt(process.env.HOLD_PICKUP_WINDOW_HOURS, 10) || 48,
  dueReminderDaysBefore: parseInt(process.env.DUE_REMINDER_DAYS_BEFORE, 10) || 2,
  streakReminderHoursBefore: parseInt(process.env.STREAK_REMINDER_HOURS_BEFORE, 10) || 3,
  labOperatingHours: {
    startHour: parseInt(process.env.LAB_START_HOUR, 10) || 8, // 8 AM UTC/Local
    endHour: parseInt(process.env.LAB_END_HOUR, 10) || 20,   // 8 PM UTC/Local
  },
  redisUrl: process.env.REDIS_URL || null,
  rateLimits: {
    globalMax: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX, 10) || 100,
    globalWindowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS, 10) || 60000,
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 5,
    authWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 10) || 15 * 60 * 1000,
    userMax: parseInt(process.env.RATE_LIMIT_USER_MAX, 10) || 100,
    userWindowMs: parseInt(process.env.RATE_LIMIT_USER_WINDOW_MS, 10) || 60000,
    expensiveMax: parseInt(process.env.RATE_LIMIT_EXPENSIVE_MAX, 10) || 10,
    expensiveWindowMs: parseInt(process.env.RATE_LIMIT_EXPENSIVE_WINDOW_MS, 10) || 60000,
  },
};

module.exports = config;
