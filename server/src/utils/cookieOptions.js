const config = require('../config');

/**
 * Returns serverless & cross-site hardened cookie configuration.
 * For same-origin rewrites, sameSite defaults to 'lax'.
 * For explicit cross-domain setups or HTTPS production deployments, supports 'none' with secure: true.
 */
const getAuthCookieOptions = (req, overrides = {}) => {
  const isProd = config.nodeEnv === 'production' || process.env.VERCEL === '1';
  const origin = req?.headers?.origin || '';
  const isCrossSite = origin && !origin.includes(req?.headers?.host);

  const sameSite = isCrossSite && isProd ? 'none' : 'lax';
  const secure = isProd || sameSite === 'none';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    ...overrides,
  };
};

module.exports = {
  getAuthCookieOptions,
};
