// Express application configuration and middleware wiring.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const config = require('./config');
const logger = require('./utils/logger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const mongoose = require('mongoose');

const app = express();
const crypto = require('crypto');

// Assign Request ID
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);

// Body Parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// NoSQL Injection Defense
app.use(mongoSanitize());

// Request Logger
app.use(
  morgan(config.nodeEnv === 'production' ? 'combined' : 'dev', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Global Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    code: 429,
  },
});
app.use(limiter);

// Health Check Route
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const isHealthy = dbStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    dbConnection: dbStatus,
    uptime: `${process.uptime().toFixed(2)}s`,
    timestamp: new Date().toISOString(),
  });
});

// Backward compatible health check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const isHealthy = dbStatus === 'connected';
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy ? 'Server is running' : 'Database connection error',
  });
});

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

// Domain Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));
app.use('/api/fines', require('./routes/fineRoutes'));
app.use('/api/patron-card', require('./routes/patronCardRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api/reading-lists', require('./routes/readingListRoutes'));
app.use('/api/bookmarks', require('./routes/bookmarkRoutes'));
app.use('/api/saved-searches', require('./routes/savedSearchRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/eresources', require('./routes/eresourceRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Dashboard Routes
app.use('/api/dashboards/admin-portal', require('./routes/dashboards/adminPortalRoutes'));
app.use('/api/dashboards/college-admin', require('./routes/dashboards/collegeAdminRoutes'));
app.use('/api/dashboards/student', require('./routes/dashboards/studentDashboardRoutes'));
app.use('/api/dashboards/general', require('./routes/dashboards/generalDashboardRoutes'));

// Feature Routes
app.use('/api/lab', require('./routes/labRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/book-suggestions', require('./routes/bookSuggestionRoutes'));
app.use('/api/eresources/external', require('./routes/eresourceExternalRoutes'));
app.use('/api/streak', require('./routes/streakRoutes'));
app.use('/api/stickers', require('./routes/stickerRoutes'));

// Error Handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
