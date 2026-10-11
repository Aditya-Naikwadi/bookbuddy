const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Support MONGODB_URI alias (Vercel / Mongo Atlas standard)
if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
  process.env.MONGO_URI = process.env.MONGODB_URI;
}

const isTest = process.env.NODE_ENV === 'test';

const requiredString = (name, customMsg, minLen = 1) =>
  z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z
      .string({
        required_error: customMsg || `${name} is required`,
        invalid_type_error: customMsg || `${name} is required`,
      })
      .min(minLen, customMsg || `${name} must be at least ${minLen} characters long`)
  );

const KNOWN_DEFAULT_SECRETS = [
  'secret',
  'jwtsecret',
  'yoursecretkey123',
  'yourrefreshsecretkey456',
  'supersecretrefresh123',
  'supersecret123',
  'supersecretsession123',
  'testjwtsecretkey999',
  'password',
  'password123',
  'admin',
  'admin123',
  'changeme',
  '123456',
  '12345678',
  '1234567890',
  'devsuperadminpass@2026!',
  'bookbuddy_scanner_secret_2026',
  'placeholder_razorpay_secret_key',
  'rzp_test_placeholder_id',
  'default_jwt_secret',
  'default_secret',
];

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().default('0.0.0.0'),

  MONGO_URI: isTest
    ? z.string().default('mongodb://127.0.0.1:27017/bookbuddy_test')
    : requiredString('MONGO_URI', 'MONGO_URI is required').refine(
        (val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'),
        {
          message:
            'MONGO_URI must be a valid connection string starting with mongodb:// or mongodb+srv://',
        }
      ),

  JWT_SECRET: isTest
    ? z.string().min(1).default('testjwtsecretkey999')
    : requiredString(
        'JWT_SECRET',
        'JWT_SECRET is required and must be at least 32 characters (256 bits) in production',
        process.env.NODE_ENV === 'production' ? 32 : 8
      ).refine((val) => !KNOWN_DEFAULT_SECRETS.includes(val.toLowerCase()), {
        message: 'JWT_SECRET must not use a weak or default value',
      }),

  JWT_REFRESH_SECRET: isTest
    ? z.string().min(1).default('supersecretrefresh123')
    : requiredString(
        'JWT_REFRESH_SECRET',
        'JWT_REFRESH_SECRET is required and must be at least 32 characters (256 bits) in production',
        process.env.NODE_ENV === 'production' ? 32 : 8
      ).refine((val) => !KNOWN_DEFAULT_SECRETS.includes(val.toLowerCase()), {
        message: 'JWT_REFRESH_SECRET must not use a weak or default value',
      }),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  JWT_ISSUER: z.string().default('bookbuddy-api'),
  JWT_AUDIENCE: z.string().default('bookbuddy-client'),

  CLIENT_ORIGIN: z.string().default('*'),
  CLIENT_URL: z.string().optional(),

  REDIS_URL: isTest
    ? z.string().default('redis://127.0.0.1:6379')
    : requiredString(
        'REDIS_URL',
        'REDIS_URL is required — this app relies on Redis for multi-instance Socket.io'
      ),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().optional(),

  // Mailer
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Algolia
  ALGOLIA_APP_ID: z.string().optional(),
  ALGOLIA_ADMIN_KEY: z.string().optional(),
  ALGOLIA_INDEX_NAME: z.string().default('bookbuddy_books'),

  // Google OAuth & Books
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().optional(),

  // Razorpay
  RAZORPAY_KEY_ID: isTest ? z.string().default('rzp_test_placeholder_id') : z.string().optional(),
  RAZORPAY_KEY_SECRET: isTest
    ? z.string().default('placeholder_razorpay_secret_key')
    : z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Business logic settings
  LOAN_PERIOD_DAYS: z.coerce.number().default(14),
  MAX_RENEWALS: z.coerce.number().default(2),
  UNPAID_FINE_LIMIT: z.coerce.number().default(100),
  FINE_RATE_PER_DAY: z.coerce.number().default(5),
  FINE_MAX_AMOUNT: z.coerce.number().default(100),
  HOLD_PICKUP_WINDOW_HOURS: z.coerce.number().default(48),
  DUE_REMINDER_DAYS_BEFORE: z.coerce.number().default(2),
  STREAK_REMINDER_HOURS_BEFORE: z.coerce.number().default(3),
  LAB_START_HOUR: z.coerce.number().default(8),
  LAB_END_HOUR: z.coerce.number().default(20),

  // Rate Limits
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().default(100),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(5),
  RATE_LIMIT_AUTH_IP_MAX: z.coerce.number().default(20),
  RATE_LIMIT_AUTH_EMAIL_MAX: z.coerce.number().default(5),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_USER_MAX: z.coerce.number().default(100),
  RATE_LIMIT_USER_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_EXPENSIVE_MAX: z.coerce.number().default(10),
  RATE_LIMIT_EXPENSIVE_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_SEARCH_MAX: z.coerce.number().default(30),
  RATE_LIMIT_SEARCH_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_PATRON_CARD_VERIFY_MAX: z.coerce.number().default(60),
  RATE_LIMIT_PATRON_CARD_VERIFY_WINDOW_MS: z.coerce.number().default(60000),
  LOGIN_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_LOCKOUT_DURATION_S: z.coerce.number().default(900),
  LOGIN_LOCKOUT_WINDOW_S: z.coerce.number().default(900),
  TRUST_PROXY: z.union([z.boolean(), z.number(), z.string()]).default(false),

  // Scanner Gate Verification Security
  SCANNER_API_KEY: z.string().default('bookbuddy_scanner_secret_2026'),

  // Deployment / Platform flags
  VERCEL: z.string().optional(),
  RENDER: z.string().optional(),
  MONGO_MAX_POOL_SIZE: z.coerce.number().optional(),
  ERROR_WEBHOOK_URL: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  SIEM_WEBHOOK_URL: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  ENABLE_MEMORY_LOGGING: z.string().optional(),
  APP_VERSION: z.string().optional(),
  RENDER_GIT_COMMIT: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  COMMIT_SHA: z.string().optional(),
  GITHUB_SHA: z.string().optional(),
  BUILD_ID: z.string().optional(),
  GUTENDEX_BASE_URL: z.string().optional(),
  GUTENDEX_CACHE_TTL_SECONDS: z.coerce.number().optional(),
  GUTENDEX_TIMEOUT_MS: z.coerce.number().optional(),
  OPEN_LIBRARY_USER_AGENT: z.string().optional(),
  ROTATION_GRACE_PERIOD_MS: z.coerce.number().optional(),
  EMAIL_DRIVER_THROW: z.string().optional(),
  PUSH_DRIVER_THROW: z.string().optional(),
  TEST_CSRF: z.string().optional(),
  TEST_AUDIT_IMMUTABLE: z.string().optional(),
  INSTANCE_ID: z.string().optional(),
  PM2_ID: z.string().optional(),

  // Twilio / SMS Integration
  TWILIO_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
});

function checkDefaultCredentials(envData) {
  if (envData.NODE_ENV !== 'production') {
    return;
  }

  const errors = [];

  const isKnownDefault = (val) => {
    if (!val || typeof val !== 'string') return false;
    const lower = val.toLowerCase().trim();
    return KNOWN_DEFAULT_SECRETS.includes(lower);
  };

  if (isKnownDefault(envData.JWT_SECRET)) {
    errors.push('JWT_SECRET cannot be a default or known weak secret in production');
  }

  if (isKnownDefault(envData.JWT_REFRESH_SECRET)) {
    errors.push('JWT_REFRESH_SECRET cannot be a default or known weak secret in production');
  }

  if (
    envData.JWT_SECRET &&
    envData.JWT_REFRESH_SECRET &&
    envData.JWT_SECRET === envData.JWT_REFRESH_SECRET
  ) {
    errors.push('JWT_REFRESH_SECRET must be different from JWT_SECRET in production');
  }

  if (envData.SCANNER_API_KEY === 'bookbuddy_scanner_secret_2026') {
    errors.push('SCANNER_API_KEY must not use the default fallback key in production');
  }

  if (envData.MONGO_URI) {
    const defaultMongoCreds = [
      'admin:admin@',
      'root:root@',
      'root:password@',
      'user:password@',
      'mongo:mongo@',
      'mongodb://127.0.0.1:27017/bookbuddy_test',
    ];
    if (defaultMongoCreds.some((cred) => envData.MONGO_URI.toLowerCase().includes(cred))) {
      errors.push('MONGO_URI contains default or unauthenticated test database credentials');
    }
  }

  const superAdminPass = process.env.SEED_SUPER_ADMIN_PASSWORD || process.env.SUPERADMIN_PASSWORD;
  if (superAdminPass && isKnownDefault(superAdminPass)) {
    errors.push('SEED_SUPER_ADMIN_PASSWORD cannot be a known default password in production');
  }

  if (envData.RAZORPAY_KEY_SECRET && isKnownDefault(envData.RAZORPAY_KEY_SECRET)) {
    errors.push('RAZORPAY_KEY_SECRET cannot use default or placeholder credentials in production');
  }

  if (errors.length > 0) {
    throw new Error(
      `❌ Production Security Violation: Default credentials detected:\n  - ${errors.join('\n  - ')}`
    );
  }
}

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const errorDetails = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
      .join('; ');

    // If running unit tests expecting error throwing or process.exit
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
      throw new Error(`Environment validation failed: ${errorDetails}`);
    }

    // eslint-disable-next-line no-console
    console.error('\n❌ FATAL: Environment variable validation failed:');
    for (const [field, errors] of Object.entries(fieldErrors)) {
      // eslint-disable-next-line no-console
      console.error(`  - ${field}: ${errors.join(', ')}`);
    }
    // eslint-disable-next-line no-console
    console.error(
      '\nPlease fix the environment configuration in backend/.env before starting the server.\n'
    );
    process.exit(1);
  }

  const data = result.data;

  // Enforce default credential prohibition in production
  checkDefaultCredentials(data);

  // Additional production validation check
  if (data.NODE_ENV === 'production' && !data.VERCEL && !data.RENDER) {
    const prodRequired = ['GOOGLE_BOOKS_API_KEY', 'REDIS_URL'];
    const missingProdEnv = prodRequired.filter((key) => !process.env[key]);
    if (missingProdEnv.length > 0) {
      throw new Error(
        `❌ Fatal Startup Error: Missing required production environment variables: [${missingProdEnv.join(', ')}].`
      );
    }
  }

  return data;
}

const env = validateEnv();
env.checkDefaultCredentials = checkDefaultCredentials;

module.exports = env;
