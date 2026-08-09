const config = require('../config');
const logger = require('../utils/logger');
const { sendAlert } = require('../utils/alerting');

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
    const field = Object.keys(err.keyValue || {})[0] || 'record';
    message = `A record with this ${field} already exists.`;
    err.isOperational = true;
  } else if (
    err.name === 'MongooseError' ||
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    statusCode = 503;
    message = 'Database service unavailable. Please check MongoDB Atlas IP whitelist (0.0.0.0/0).';
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
    // Dispatch alert for non-operational errors
    sendAlert(err, req);
  }

  const response = {
    success: false,
    message: displayMessage,
    code: statusCode,
    requestId,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
