const config = require('../config');
const logger = require('../utils/logger');
const { sendAlert } = require('../utils/alerting');
const { captureException } = require('../utils/sentry');

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Sanitize and handle database-specific errors safely
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field: ${err.path}`;
    err.isOperational = true;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((el) => el.message)
      .join('. ');
    err.isOperational = true;
  } else if (err.code === 11000) {
    statusCode = 409;
    const rawField = Object.keys(err.keyValue || {})[0] || 'record';
    const field = String(rawField).replace(/[^a-zA-Z0-9_]/g, '') || 'record';
    message = `A record with this ${field} already exists.`;
    err.isOperational = true;
  } else if (
    err.name === 'MongooseError' ||
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    statusCode = 503;
    message =
      config.nodeEnv === 'production'
        ? 'Database service temporarily unavailable. Please try again later.'
        : 'Database service unavailable. Please check MongoDB connection.';
    err.isOperational = true;
  } else if (err.name === 'MongoServerError' || err.name === 'BSONError') {
    statusCode = 400;
    message = 'Invalid database query or request parameters.';
    err.isOperational = true;
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File size exceeds allowed limit.'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Too many files uploaded.'
          : `File upload error: ${err.message}`;
    err.isOperational = true;
  }

  const isProd = config.nodeEnv === 'production';
  const displayMessage =
    err.isOperational || !isProd
      ? message
      : 'An unexpected error occurred. Please contact support.';
  const requestId = req.id || 'N/A';

  // Log error based on operational vs non-operational status
  if (err.isOperational) {
    logger.warn(`Operational Error [${statusCode}]: ${message}`, { requestId });
  } else {
    logger.error(`Unexpected Error [${statusCode}]: ${message}`, { stack: err.stack, requestId });
    // Dispatch alert & capture Sentry exception for non-operational errors
    sendAlert(err, req);
    captureException(err, { requestId });
  }

  const response = {
    success: false,
    message: displayMessage,
    code: typeof err.code === 'string' ? err.code : err.errorCode || statusCode,
    statusCode,
    requestId,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
