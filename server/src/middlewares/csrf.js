const crypto = require('crypto');
const AppError = require('../utils/AppError');
const config = require('../config');

const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const getCsrfTokenController = (req, res) => {
  const csrfToken = generateCsrfToken();
  res.cookie('_csrf', csrfToken, {
    httpOnly: false, // Read by frontend script to set x-csrf-token header
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({
    success: true,
    csrfToken,
  });
};

const validateCsrf = (req, res, next) => {
  if (
    (config.nodeEnv === 'test' || process.env.NODE_ENV === 'test') &&
    process.env.TEST_CSRF !== 'true' &&
    !req.cookies?._csrf
  ) {
    return next();
  }

  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  const exemptPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/registration',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/registration',
  ];
  const isExempt = exemptPaths.some((path) => req.originalUrl.startsWith(path));

  const csrfCookie = req.cookies?._csrf;
  const csrfHeader = req.headers['x-csrf-token'] || req.body?._csrf;

  if (isExempt && !csrfCookie && !csrfHeader) {
    return next();
  }

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return next(new AppError('Invalid or missing CSRF token.', 403));
  }

  next();
};

module.exports = {
  getCsrfTokenController,
  validateCsrf,
};
