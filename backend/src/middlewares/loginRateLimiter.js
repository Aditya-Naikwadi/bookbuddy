// Progressive login rate limiter using rate-limiter-flexible
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const { redisClient } = require('./rateLimiters');
const AppError = require('../utils/AppError');

const maxConsecutiveFailsByRoute = 5;
const durationInSeconds = 900; // 15 minutes window
const blockDurationInSeconds = 900; // 15 minutes block penalty

let limiterConsecutiveFails;

const createLimiter = () => {
  const opts = {
    keyPrefix: 'login_fail_consecutive',
    points: maxConsecutiveFailsByRoute,
    duration: durationInSeconds,
    blockDuration: blockDurationInSeconds,
  };

  if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
    limiterConsecutiveFails = new RateLimiterRedis({
      storeClient: redisClient,
      ...opts,
    });
  } else {
    limiterConsecutiveFails = new RateLimiterMemory(opts);
  }
};

createLimiter();

const getClientKey = (req) => {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  const ip =
    (forwardedFor && typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : null) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
  const email = (req.body?.email || req.body?.studentId || '').toLowerCase().trim();
  return `${ip}_${email}`;
};

const loginRateLimiter = async (req, res, next) => {
  if (!limiterConsecutiveFails) {
    createLimiter();
  }

  const key = getClientKey(req);

  try {
    const resLimiter = await limiterConsecutiveFails.get(key);

    if (resLimiter && resLimiter.consumedPoints >= maxConsecutiveFailsByRoute) {
      const retrySecs = Math.round(resLimiter.msBeforeNext / 1000) || durationInSeconds;
      res.set('Retry-After', String(retrySecs));
      return next(new AppError('Too many failed login attempts, please try again later.', 429));
    }
    next();
  } catch (error) {
    if (error && error.msBeforeNext) {
      const retrySecs = Math.round(error.msBeforeNext / 1000) || durationInSeconds;
      res.set('Retry-After', String(retrySecs));
      return next(new AppError('Too many failed login attempts, please try again later.', 429));
    }
    next();
  }
};

const consumeFailedLogin = async (req) => {
  if (!limiterConsecutiveFails) createLimiter();
  const key = getClientKey(req);
  try {
    await limiterConsecutiveFails.consume(key);
  } catch {
    // Ignore rate limiter consumption error
  }
};

const resetFailedLogins = async (req) => {
  if (!limiterConsecutiveFails) createLimiter();
  const key = getClientKey(req);
  try {
    await limiterConsecutiveFails.delete(key);
  } catch {
    // Ignore rate limiter delete error
  }
};

module.exports = {
  loginRateLimiter,
  consumeFailedLogin,
  resetFailedLogins,
};
