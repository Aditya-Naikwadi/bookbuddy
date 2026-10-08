const crypto = require('crypto');
const AppError = require('../utils/AppError');
const config = require('../config');
const logger = require('../utils/logger');
const { getAuthCookieOptions } = require('../utils/cookieOptions');

const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const allowedOrigins = [
  config.clientOrigin,
  'https://book-buddy-eight-rosy.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

const vercelDomainRegex = /^https:\/\/(?:[a-z0-9-]+\.)?book-buddy[a-z0-9-]*\.vercel\.app$/i;

/**
 * Validates whether an incoming request Origin or Referer matches trusted domains.
 */
const isAllowedOrigin = (origin, host) => {
  if (!origin) return true; // Same-origin or non-browser request without Origin header
  const trimmed = origin.trim();

  // If host header is present, check against current server host
  if (host) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.host.toLowerCase() === host.toLowerCase()) {
        return true;
      }
    } catch {
      return false;
    }
  }

  if (allowedOrigins.includes(trimmed)) {
    return true;
  }

  if (vercelDomainRegex.test(trimmed)) {
    return true;
  }

  // Tenant subdomain wildcard matching (e.g., https://mit.bookbuddy.com)
  if (/^https:\/\/(?:[a-z0-9-]+\.)?bookbuddy\.com(?::\d+)?$/i.test(trimmed)) {
    return true;
  }

  // Local development tenant subdomains
  if (/^http:\/\/(?:[a-z0-9-]+\.)?localhost(?::\d+)?$/i.test(trimmed)) {
    return true;
  }
  if (/^http:\/\/(?:[a-z0-9-]+\.)?127\.0\.0\.1(?::\d+)?$/i.test(trimmed)) {
    return true;
  }

  return false;
};

/**
 * Constant-time string comparison to prevent CSRF token timing attacks.
 */
const safeCompareTokens = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
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
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  // 1. Server-side Origin / Referer Verification
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    if (!isAllowedOrigin(origin, req.headers.host)) {
      return next(new AppError('Cross-origin request blocked by CSRF protection.', 403));
    }
  } else if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!isAllowedOrigin(refererOrigin, req.headers.host)) {
        return next(new AppError('Cross-origin request blocked by CSRF protection.', 403));
      }
    } catch {
      return next(new AppError('Invalid referer header blocked by CSRF protection.', 403));
    }
  }

  // 2. Webhook exemption (only webhooks that verify cryptographic signatures)
  const isWebhook =
    req.originalUrl?.includes('/payments/webhook') || req.url?.includes('/payments/webhook');

  if (isWebhook) {
    return next();
  }

  // 3. Pre-session onboarding & public authentication routes
  const exemptPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/google',
    '/api/registration',
    '/api/auth/refresh',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/google',
    '/api/v1/registration',
    '/api/v1/auth/refresh',
  ];
  const isExempt = exemptPaths.some(
    (path) => req.originalUrl?.startsWith(path) || req.url?.startsWith(path)
  );

  const csrfCookie = req.cookies?._csrf;
  const csrfHeader = req.headers['x-csrf-token'] || req.body?._csrf;

  if (isExempt && (!csrfCookie || !csrfHeader)) {
    return next();
  }

  // Test mode bypass when not explicitly testing CSRF and no CSRF cookie/header sent
  if (
    (config.nodeEnv === 'test' || process.env.NODE_ENV === 'test') &&
    process.env.TEST_CSRF !== 'true' &&
    !csrfCookie &&
    !req.headers['x-test-csrf']
  ) {
    return next();
  }

  // 4. Double-Submit Token Verification (timing-safe comparison)
  if (!csrfCookie || !csrfHeader || !safeCompareTokens(csrfCookie, csrfHeader)) {
    return next(new AppError('Invalid or missing CSRF token.', 403));
  }

  next();
};

module.exports = {
  getCsrfTokenController,
  validateCsrf,
  isAllowedOrigin,
  safeCompareTokens,
};
