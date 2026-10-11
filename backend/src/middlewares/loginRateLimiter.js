// Progressive login rate limiter using rate-limiter-flexible
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const { redisClient, getClientIp } = require('./rateLimiters');
const config = require('../config');
const AppError = require('../utils/AppError');

let limiterConsecutiveFails;

const createLimiter = () => {
  const maxConsecutiveFailsByRoute = config.loginLockout?.maxAttempts || 5;
  const durationInSeconds = config.loginLockout?.windowS || 900;
  const blockDurationInSeconds = config.loginLockout?.durationS || 900;

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
  const ip = getClientIp(req);
  const rawIdent =
    typeof req?.body?.email === 'string'
      ? req.body.email
      : typeof req?.body?.studentId === 'string'
        ? req.body.studentId
        : '';
  const email = rawIdent.toLowerCase().trim();
  return `${ip}_${email}`;
};

const loginRateLimiter = async (req, res, next) => {
  if (!limiterConsecutiveFails) {
    createLimiter();
  }

  const key = getClientKey(req);
  const maxConsecutiveFailsByRoute = config.loginLockout?.maxAttempts || 5;
  const blockDurationInSeconds = config.loginLockout?.durationS || 900;

  try {
    const resLimiter = await limiterConsecutiveFails.get(key);

    if (resLimiter && resLimiter.consumedPoints >= maxConsecutiveFailsByRoute) {
      const retrySecs = Math.round(resLimiter.msBeforeNext / 1000) || blockDurationInSeconds;
      res.setHeader('Retry-After', String(retrySecs));
      return next(new AppError('Too many failed login attempts, please try again later.', 429));
    }

    // Progressive backoff: After 2 failed attempts, add a progressive artificial delay
    if (resLimiter && resLimiter.consumedPoints >= 2) {
      const backoffDelay = Math.min((resLimiter.consumedPoints - 1) * 300, 1500);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }

    next();
  } catch (error) {
    if (error && error.msBeforeNext) {
      const retrySecs = Math.round(error.msBeforeNext / 1000) || blockDurationInSeconds;
      res.setHeader('Retry-After', String(retrySecs));
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
  try {
    const { limiters } = require('./rateLimiters');
    const rawIdent =
      typeof req?.body?.email === 'string'
        ? req.body.email
        : typeof req?.body?.studentId === 'string'
          ? req.body.studentId
          : '';
    const email = rawIdent.toLowerCase().trim();
    if (email && limiters?.authEmail?.delete) {
      await limiters.authEmail.delete(email);
    }
  } catch {
    // Ignore rate limiter delete error
  }
};

const resetLoginLimiter = () => {
  createLimiter();
};

module.exports = {
  loginRateLimiter,
  consumeFailedLogin,
  resetFailedLogins,
  resetLoginLimiter,
};
