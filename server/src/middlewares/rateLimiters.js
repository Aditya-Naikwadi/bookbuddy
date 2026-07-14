const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

let redisClient = null;
let redisReady = false;

if (config.redisUrl || config.nodeEnv === 'test') {
  try {
    const isTest = config.nodeEnv === 'test';
    redisClient = new Redis(config.redisUrl || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      reconnectOnError: () => false,
      lazyConnect: isTest,
    });

    if (isTest) {
      redisReady = true;
    } else {
      redisClient.on('connect', () => {
        redisReady = true;
        logger.info('Connected to Redis for rate limiting.');
      });

      redisClient.on('error', (err) => {
        redisReady = false;
        logger.warn('Redis connection error. Rate limiting falling back to in-memory store.', err);
      });
    }
  } catch (err) {
    logger.warn('Failed to initialize Redis client. Rate limiting falling back to in-memory store.', err);
  }
}

// Factory to create a rate limiter with Redis backend and Memory fallback
const getLimiter = (keyPrefix, points, durationSeconds) => {
  const options = {
    keyPrefix,
    points,
    duration: durationSeconds,
  };

  const memoryLimiter = new RateLimiterMemory(options);
  let redisLimiter = null;

  if (redisClient) {
    redisLimiter = new RateLimiterRedis({
      ...options,
      storeClient: redisClient,
      inMemoryBlockOnConsumed: points, // Optimize by blocking in memory if fully consumed
    });
  }

  return async (key) => {
    if (redisReady && redisLimiter) {
      try {
        return await redisLimiter.consume(key);
      } catch (err) {
        if (err instanceof Error) {
          // If Redis throws a connection or execution error, fallback to memory
          logger.warn(`Redis rate limiter error for ${keyPrefix}, falling back to memory.`, err);
          return await memoryLimiter.consume(key);
        }
        // If it's a rate limit rejection (object with msBeforeNext, etc.), throw it
        throw err;
      }
    } else {
      return await memoryLimiter.consume(key);
    }
  };
};

// Initialize limiters
const limiters = {
  global: getLimiter('global', config.rateLimits.globalMax, Math.ceil(config.rateLimits.globalWindowMs / 1000)),
  auth: getLimiter('auth', config.rateLimits.authMax, Math.ceil(config.rateLimits.authWindowMs / 1000)),
  user: getLimiter('user', config.rateLimits.userMax, Math.ceil(config.rateLimits.userWindowMs / 1000)),
  expensive: getLimiter('expensive', config.rateLimits.expensiveMax, Math.ceil(config.rateLimits.expensiveWindowMs / 1000)),
};

// Helper to extract clean client IP
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
};

// Middlewares
const globalLimiter = async (req, res, next) => {
  const ip = getClientIp(req);
  try {
    await limiters.global(ip);
    next();
  } catch (rej) {
    handleRejection(ip, 'global', req, res, next, rej);
  }
};

const authLimiter = async (req, res, next) => {
  const ip = getClientIp(req);
  const identifier = (req.body.email || req.body.studentId || '').trim().toLowerCase();
  const key = `${ip}:${identifier}`;
  try {
    await limiters.auth(key);
    next();
  } catch (rej) {
    handleRejection(key, 'auth', req, res, next, rej);
  }
};

const userLimiter = async (req, res, next) => {
  const key = req.user && req.user.id ? req.user.id : getClientIp(req);
  try {
    await limiters.user(key);
    next();
  } catch (rej) {
    handleRejection(key, 'user', req, res, next, rej);
  }
};

const expensiveRouteLimiter = async (req, res, next) => {
  const key = req.user && req.user.id ? req.user.id : getClientIp(req);
  try {
    await limiters.expensive(key);
    next();
  } catch (rej) {
    handleRejection(key, 'expensive', req, res, next, rej);
  }
};

const handleRejection = (key, tierName, req, res, next, rej) => {
  const retryAfterSeconds = rej.msBeforeNext ? Math.ceil(rej.msBeforeNext / 1000) : 60;
  res.setHeader('Retry-After', String(retryAfterSeconds));

  logger.warn(`Rate limit exceeded on ${tierName} tier. Key: ${key}, Path: ${req.originalUrl || req.url}`);

  res.status(429).json({
    success: false,
    message: `Too many requests on ${tierName} limiter. Please retry after ${retryAfterSeconds} seconds.`,
    code: 429,
  });
};

module.exports = {
  globalLimiter,
  authLimiter,
  userLimiter,
  expensiveRouteLimiter,
  // Export internal helper for testing multi-instance sync
  getLimiter,
  redisClient,
};
