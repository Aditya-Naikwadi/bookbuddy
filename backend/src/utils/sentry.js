const Sentry = require('@sentry/node');
const env = require('../config/env');
const logger = require('./logger');

/**
 * Initializes Sentry Error Tracking SDK
 */
const initSentry = () => {
  const dsn = env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry DSN not provided. Operating in safe no-op mode.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: env.NODE_ENV || 'development',
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
      beforeSend(event) {
        if (event.request) {
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
            delete event.request.headers['x-csrf-token'];
          }
          if (event.request.data) {
            event.request.data = logger.sanitizeValue(event.request.data);
          }
          if (event.request.query_string) {
            event.request.query_string = logger.sanitizeUrl(event.request.query_string);
          }
        }
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        if (event.extra) {
          event.extra = logger.sanitizeValue(event.extra);
        }
        return event;
      },
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
  if (env.SENTRY_DSN) {
    try {
      const cleanContext = logger.sanitizeValue(context);
      Sentry.captureException(err, { extra: cleanContext });
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
