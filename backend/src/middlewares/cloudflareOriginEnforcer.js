const crypto = require('crypto');
const config = require('../config');
const env = require('../config/env');
const logger = require('../utils/logger');
const { cleanIp, isCloudflareIp, isTrustedProxy } = require('../utils/clientIpHelper');

/**
 * Constant-time string comparison for secret validation.
 */
const timingSafeMatch = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Middleware: Enforces that requests originate exclusively from Cloudflare edge proxy
 * when CLOUDFLARE_ENFORCE=true or when CLOUDFLARE_ORIGIN_SECRET is configured.
 *
 * Direct connections attempting to bypass Cloudflare and hit origin ports directly
 * are immediately rejected with 403 Forbidden.
 */
const cloudflareOriginEnforcer = (req, res, next) => {
  const isEnforced =
    process.env.CLOUDFLARE_ENFORCE === 'true' ||
    config.cloudflareEnforce === true ||
    Boolean(process.env.CLOUDFLARE_ORIGIN_SECRET);

  // If enforcement is disabled (e.g. dev, test, or legacy Render/Vercel during migration), pass through
  if (!isEnforced) {
    return next();
  }

  // Exempt internal health checks & monitoring endpoints
  const path = req.path || req.url || '';
  if (
    path === '/ping' ||
    path === '/api/ping' ||
    path === '/api/v1/ping' ||
    path === '/api/v1/health' ||
    path === '/health'
  ) {
    return next();
  }

  // Exempt requests carrying valid internal health token
  const healthToken = req.headers['x-health-token'];
  if (
    healthToken &&
    env.HEALTH_CHECK_TOKEN &&
    timingSafeMatch(healthToken, env.HEALTH_CHECK_TOKEN)
  ) {
    return next();
  }

  const peerIp = cleanIp(
    req.socket?.remoteAddress || req.connection?.remoteAddress || req.rawSocket?.remoteAddress || ''
  );

  // 1. Loopback check (local tools, PM2, or localhost reverse proxies)
  if (peerIp === '127.0.0.1' || peerIp === '::1' || peerIp === 'localhost') {
    // If request has X-Origin-Secret configured, verify it even on loopback if sent from Nginx
    const originSecret = process.env.CLOUDFLARE_ORIGIN_SECRET;
    if (originSecret) {
      const incomingSecret = req.headers['x-origin-secret'];
      if (!incomingSecret || !timingSafeMatch(incomingSecret, originSecret)) {
        logger.warn(`[Cloudflare Enforce] Invalid X-Origin-Secret header from ${peerIp}`);
        return res.status(403).json({
          success: false,
          message: 'Direct origin request rejected. Valid origin secret required.',
        });
      }
    }
    return next();
  }

  // 2. Origin Secret verification (Authenticated Origin Pull / Custom Header)
  const originSecret = process.env.CLOUDFLARE_ORIGIN_SECRET;
  if (originSecret) {
    const incomingSecret = req.headers['x-origin-secret'];
    if (!incomingSecret || !timingSafeMatch(incomingSecret, originSecret)) {
      logger.warn(`[Cloudflare Enforce] Blocked request to ${path} without valid X-Origin-Secret`);
      return res.status(403).json({
        success: false,
        message: 'Direct origin request rejected. Valid origin secret required.',
      });
    }
  }

  // 3. Cloudflare IP CIDR & Header verification
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  const isPeerFromCloudflare = isCloudflareIp(peerIp) || isTrustedProxy(peerIp);

  if (!cfConnectingIp || !isPeerFromCloudflare) {
    logger.warn(
      `[Cloudflare Enforce] Blocked direct origin bypass attempt from peer IP: ${peerIp} (CF-Connecting-IP: ${cfConnectingIp || 'none'})`
    );
    return res.status(403).json({
      success: false,
      message: 'Direct origin access prohibited. Traffic must route through Cloudflare edge.',
    });
  }

  next();
};

module.exports = cloudflareOriginEnforcer;
