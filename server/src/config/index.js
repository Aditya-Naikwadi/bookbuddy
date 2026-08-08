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

// Support MONGODB_URI alias (Vercel Atlas Integration standard)
if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
  process.env.MONGO_URI = process.env.MONGODB_URI;
}

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  if (process.env.VERCEL) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️ Warning: Missing environment variables on serverless start: [${missingEnv.join(', ')}]. Using safe runtime fallbacks.`
    );
  } else if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️ Warning: Missing required environment variables: [${missingEnv.join(', ')}]. Using dev fallbacks.`
    );
  }
}

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL && !process.env.RENDER) {
  const prodRequired = ['GOOGLE_BOOKS_API_KEY', 'REDIS_URL'];
  const missingProdEnv = prodRequired.filter((key) => !process.env[key]);
  if (missingProdEnv.length > 0) {
    throw new Error(
      `❌ Fatal Startup Error: Missing required production environment variables: [${missingProdEnv.join(', ')}].`
    );
  }
}

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri:
    process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/bookbuddy',
  jwt: {
    secret: process.env.JWT_SECRET || 'bookbuddy_super_secret_jwt_key_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'bookbuddy_super_secret_refresh_jwt_key_2026',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  nodeEnv: process.env.NODE_ENV || 'development',
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
    endHour: parseInt(process.env.LAB_END_HOUR, 10) || 20, // 8 PM UTC/Local
  },
  redisUrl: process.env.REDIS_URL || null,
  rateLimits: {
    globalMax: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX, 10) || 100,
    globalWindowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS, 10) || 60000,
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 5,
    authIpMax: parseInt(process.env.RATE_LIMIT_AUTH_IP_MAX, 10) || 20,
    authEmailMax: parseInt(process.env.RATE_LIMIT_AUTH_EMAIL_MAX, 10) || 5,
    authWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 10) || 15 * 60 * 1000,
    userMax: parseInt(process.env.RATE_LIMIT_USER_MAX, 10) || 100,
    userWindowMs: parseInt(process.env.RATE_LIMIT_USER_WINDOW_MS, 10) || 60000,
    expensiveMax: parseInt(process.env.RATE_LIMIT_EXPENSIVE_MAX, 10) || 10,
    expensiveWindowMs: parseInt(process.env.RATE_LIMIT_EXPENSIVE_WINDOW_MS, 10) || 60000,
  },
};

module.exports = config;
