const config = require('../config');
const logger = require('../utils/logger');
const { sendAlert } = require('../utils/alerting');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = (err.isOperational || config.nodeEnv !== 'production')
    ? (err.message || 'Internal Server Error')
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
    message,
    code: statusCode,
    requestId,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
