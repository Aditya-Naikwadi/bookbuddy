const Sentry = require('@sentry/node');
const logger = require('./logger');

/**
 * Initializes Sentry Error Tracking SDK
 */
const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry DSN not provided. Operating in safe no-op mode.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
    logger.info('Sentry Error Tracking SDK initialized successfully.');
  } catch (err) {
    logger.error('Failed to initialize Sentry:', { error: err.message });
  }
};

/**
 * Safely captures exception to Sentry and logs structured error
 */
const captureException = (err, context = {}) => {
  if (process.env.SENTRY_DSN) {
    try {
      Sentry.captureException(err, { extra: context });
    } catch {
      // Ignore Sentry dispatch errors
    }
  }
};

module.exports = {
  initSentry,
  captureException,
  Sentry,
};
