// Express application configuration and middleware wiring.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('./middlewares/mongoSanitize');

const config = require('./config');
const logger = require('./utils/logger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const mongoose = require('mongoose');

const app = express();
const crypto = require('crypto');

// Enable Trust Proxy for Render / Vercel reverse proxies (required for HTTPS secure cookies & client IP detection)
app.set('trust proxy', 1);

// Assign Request ID
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

// Security Headers
app.use(
  helmet({
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://res.cloudinary.com',
          'https://books.google.com',
          'https://coverartarchive.org',
          'https://images.unsplash.com',
        ],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
        frameAncestors: ["'none'"],
      },
    },
  })
);

// Explicit Permissions-Policy middleware
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  next();
});

// CORS Configuration supporting multi-origin dev setups & Vercel preview deployment URLs
const allowedOrigins = [
  config.clientOrigin,
  'https://book-buddy-eight-rosy.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (origin.endsWith('.vercel.app') && origin.startsWith('https://'))
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-csrf-token',
      'x-request-id',
      'idempotency-key',
    ],
  })
);

const hpp = require('hpp');

// Body Parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// HTTP Parameter Pollution Protection
app.use(hpp());

// Passport OAuth Middleware Initialization
const passport = require('./config/passport');
app.use(passport.initialize());

// Custom Cookie Parser Middleware
app.use((req, res, next) => {
  req.cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      req.cookies[name] = decodeURIComponent(value);
    });
  }
  next();
});

// NoSQL Injection Defense
app.use(mongoSanitize);

// Request Logger
app.use(
  morgan(config.nodeEnv === 'production' ? 'combined' : 'dev', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Lightweight Ping Handler for Keep-Alive & Process Warming (Zero DB / Redis overhead)
const pingController = (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
};

// Zero-overhead ping routes (process warming)
app.get('/ping', pingController);
app.get('/api/ping', pingController);
app.get('/api/v1/ping', pingController);

// Unified Detailed Health Check Handler
const getHealthStatus = async () => {
  const readyState = mongoose.connection.readyState;
  const dbStatus =
    readyState === 1 ? 'connected' : readyState === 2 ? 'connecting' : 'disconnected';

  let redisStatus = 'disabled';
  try {
    const { redisClient } = require('./middlewares/rateLimiters');
    if (redisClient && typeof redisClient.ping === 'function') {
      const pingRes = await redisClient.ping();
      redisStatus = pingRes === 'PONG' ? 'connected' : 'degraded';
    }
  } catch {
    redisStatus = 'disconnected';
  }

  const isHealthy = readyState === 1;

  return {
    isHealthy,
    statusCode: isHealthy ? 200 : 503,
    payload: {
      status: isHealthy ? 'ok' : 'unhealthy',
      success: isHealthy,
      message: isHealthy
        ? 'Service operating normally.'
        : `Database connection not ready (Mongoose readyState: ${readyState} [${dbStatus}]).`,
      dbState: dbStatus,
      dbConnection: dbStatus,
      dbReadyState: readyState,
      redisConnection: redisStatus,
      environment: config.nodeEnv,
      uptime: `${process.uptime().toFixed(2)}s`,
      timestamp: new Date().toISOString(),
    },
  };
};

const healthCheckController = async (req, res) => {
  const health = await getHealthStatus();
  res.status(health.statusCode).json(health.payload);
};

// Full Health Check Routes
app.get('/health', healthCheckController);
app.get('/api/health', healthCheckController);
app.get('/api/v1/health', healthCheckController);

// Apply custom global rate limiter to all routes except health checks
const { globalLimiter } = require('./middlewares/rateLimiters');
const { validateCsrf } = require('./middlewares/csrf');
app.use(globalLimiter);
app.use(validateCsrf);

// Debug tenant check route for validation
const { protect, requireRole } = require('./middlewares/auth');
const scopeToTenant = require('./middlewares/scopeToTenant');
app.get(
  '/api/_debug/tenant-check',
  protect,
  requireRole('college-admin', 'college_admin', 'student'),
  scopeToTenant,
  (req, res) => {
    res.json({
      success: true,
      user: req.user,
      tenantFilter: req.tenantFilter,
    });
  }
);

// Debug test route for rate limiter verification
app.all(
  '/api/_debug/test-limiter',
  (req, res, next) => {
    // Dynamically apply limiter to avoid side effects during normal app use
    const { authLimiter } = require('./middlewares/rateLimiters');
    authLimiter(req, res, next);
  },
  (req, res) => {
    res.json({
      success: true,
      body: req.body,
      query: req.query,
    });
  }
);
const deprecationWarning = require('./middlewares/deprecationWarning');

// Canonical API Version 1 Routes
app.use('/api/colleges', require('./routes/collegeFeatureRoutes'));
app.use('/api/v1/colleges', require('./routes/collegeFeatureRoutes'));
app.use('/api/v1/college/:id/books', require('./routes/collegeBookRoutes'));
app.use('/api/v1/catalog', require('./routes/catalogRoutes'));
app.use('/api/v1/services', require('./routes/serviceRoutes'));
app.use('/api/v1/college/:id', require('./routes/bulkUploadRoutes'));
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/registration', require('./routes/registrationRoutes'));
app.use('/api/v1/books', require('./routes/bookRoutes'));
app.use('/api/v1/loans', require('./routes/loanRoutes'));
app.use('/api/v1/fines', require('./routes/fineRoutes'));
app.use('/api/v1/patron-card', require('./routes/patronCardRoutes'));
app.use('/api/v1/reservations', require('./routes/reservationRoutes'));
app.use('/api/v1/reading-lists', require('./routes/readingListRoutes'));
app.use('/api/v1/bookmarks', require('./routes/bookmarkRoutes'));
app.use('/api/v1/saved-searches', require('./routes/savedSearchRoutes'));
app.use('/api/v1/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/v1/eresources', require('./routes/eresourceRoutes'));
app.use('/api/v1/reader', require('./routes/readerRoutes'));
app.use('/api/v1/notifications', require('./routes/notificationRoutes'));
app.use('/api/v1/payments', require('./routes/paymentRoutes'));
app.use('/api/v1/annotations', require('./routes/annotationRoutes'));
app.use('/api/v1/aggregator', require('./routes/aggregatorRoutes'));

const { getOpenApiSpec } = require('./docs/openapi');
app.get('/api/v1/docs/swagger.json', (req, res) => res.json(getOpenApiSpec()));
app.use('/api/v1/dashboards/admin-portal', require('./routes/dashboards/adminPortalRoutes'));
app.use('/api/v1/dashboards/college-admin', require('./routes/dashboards/collegeAdminRoutes'));
app.use('/api/v1/dashboards/student', require('./routes/dashboards/studentDashboardRoutes'));
app.use('/api/v1/dashboards/general', require('./routes/dashboards/generalDashboardRoutes'));
app.use('/api/v1/college', require('./routes/dashboards/generalDashboardRoutes'));
app.use('/api/v1/lab', require('./routes/labRoutes'));
app.use('/api/v1/feedback', require('./routes/feedbackRoutes'));
app.use('/api/v1/complaints', require('./routes/complaintRoutes'));
app.use('/api/v1/book-suggestions', require('./routes/bookSuggestionRoutes'));
app.use('/api/v1/eresources/external', require('./routes/eresourceExternalRoutes'));
app.use('/api/v1/google-books', require('./routes/googleBooksRoutes'));
app.use('/api/v1/streak', require('./routes/streakRoutes'));
app.use('/api/v1/stickers', require('./routes/stickerRoutes'));

// Deprecated Legacy Unversioned Routes (Supported with 90-day deprecation headers)
app.use('/api/college/:id/books', deprecationWarning, require('./routes/collegeBookRoutes'));
app.use('/api/catalog', deprecationWarning, require('./routes/catalogRoutes'));
app.use('/api/services', deprecationWarning, require('./routes/serviceRoutes'));
app.use('/api/college/:id', deprecationWarning, require('./routes/bulkUploadRoutes'));
app.use('/api/auth', deprecationWarning, require('./routes/authRoutes'));
app.use('/api/registration', deprecationWarning, require('./routes/registrationRoutes'));
app.use('/api/books', deprecationWarning, require('./routes/bookRoutes'));
app.use('/api/loans', deprecationWarning, require('./routes/loanRoutes'));
app.use('/api/fines', deprecationWarning, require('./routes/fineRoutes'));
app.use('/api/patron-card', deprecationWarning, require('./routes/patronCardRoutes'));
app.use('/api/reservations', deprecationWarning, require('./routes/reservationRoutes'));
app.use('/api/reading-lists', deprecationWarning, require('./routes/readingListRoutes'));
app.use('/api/bookmarks', deprecationWarning, require('./routes/bookmarkRoutes'));
app.use('/api/saved-searches', deprecationWarning, require('./routes/savedSearchRoutes'));
app.use('/api/recommendations', deprecationWarning, require('./routes/recommendationRoutes'));
app.use('/api/eresources', deprecationWarning, require('./routes/eresourceRoutes'));
app.use('/api/reader', deprecationWarning, require('./routes/readerRoutes'));
app.use('/api/notifications', deprecationWarning, require('./routes/notificationRoutes'));
app.use('/api/payments', deprecationWarning, require('./routes/paymentRoutes'));
app.use('/api/v1/uploads', require('./routes/uploadRoutes'));
app.use('/api/uploads', deprecationWarning, require('./routes/uploadRoutes'));
app.use('/api/annotations', deprecationWarning, require('./routes/annotationRoutes'));

// Gamification spec aliases
app.post('/api/checkin', deprecationWarning, (req, res, next) => {
  req.url = '/checkin';
  require('./routes/streakRoutes')(req, res, next);
});
app.get('/api/streak', deprecationWarning, (req, res, next) => {
  req.url = '/me';
  require('./routes/streakRoutes')(req, res, next);
});
app.get('/api/streak/history', deprecationWarning, (req, res, next) => {
  req.url = '/history';
  require('./routes/streakRoutes')(req, res, next);
});
app.use('/api/badges', deprecationWarning, (req, res, next) => {
  req.url = '/badges' + (req.url === '/' ? '' : req.url);
  require('./routes/streakRoutes')(req, res, next);
});

// Dashboard Routes (Deprecated unversioned aliases)
app.use(
  '/api/dashboards/admin-portal',
  deprecationWarning,
  require('./routes/dashboards/adminPortalRoutes')
);
app.use(
  '/api/dashboards/college-admin',
  deprecationWarning,
  require('./routes/dashboards/collegeAdminRoutes')
);
app.use(
  '/api/dashboards/student',
  deprecationWarning,
  require('./routes/dashboards/studentDashboardRoutes')
);
app.use(
  '/api/dashboards/general',
  deprecationWarning,
  require('./routes/dashboards/generalDashboardRoutes')
);

// Feature Routes (Deprecated unversioned aliases)
app.use('/api/lab', deprecationWarning, require('./routes/labRoutes'));
app.use('/api/feedback', deprecationWarning, require('./routes/feedbackRoutes'));
app.use('/api/complaints', deprecationWarning, require('./routes/complaintRoutes'));
app.use('/api/book-suggestions', deprecationWarning, require('./routes/bookSuggestionRoutes'));
app.use(
  '/api/eresources/external',
  deprecationWarning,
  require('./routes/eresourceExternalRoutes')
);
app.use('/api/google-books', deprecationWarning, require('./routes/googleBooksRoutes'));
app.use('/api/streak', deprecationWarning, require('./routes/streakRoutes'));
app.use('/api/stickers', deprecationWarning, require('./routes/stickerRoutes'));

// Error Handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
