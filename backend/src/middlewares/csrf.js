const crypto = require('crypto');
const AppError = require('../utils/AppError');
const config = require('../config');
const logger = require('../utils/logger');

const { getAuthCookieOptions } = require('../utils/cookieOptions');

const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const getCsrfTokenController = (req, res) => {
  try {
    const csrfToken = generateCsrfToken();
    try {
      const opts = getAuthCookieOptions(req, {
        httpOnly: false, // Read by frontend script to set x-csrf-token header
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.cookie('_csrf', csrfToken, opts);
    } catch (cookieErr) {
      logger.warn('Failed to set _csrf cookie:', cookieErr.message);
    }
    return res.json({
      success: true,
      csrfToken,
    });
  } catch (err) {
    logger.error('CSRF Generation Error:', err.message);
    return res.json({
      success: true,
      csrfToken: crypto.randomBytes(32).toString('hex'),
    });
  }
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
    '/api/auth/google',
    '/api/registration',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/google',
    '/api/v1/registration',
  ];
  const isExempt = exemptPaths.some(
    (path) => req.originalUrl?.startsWith(path) || req.url?.startsWith(path)
  );

  const csrfCookie = req.cookies?._csrf;
  const csrfHeader = req.headers['x-csrf-token'] || req.body?._csrf;

  if (isExempt && (!csrfCookie || !csrfHeader)) {
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
