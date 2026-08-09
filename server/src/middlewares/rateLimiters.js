const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let redisClient = null;
let redisReady = false;

const isTest = config.nodeEnv === 'test';
const isMock = RateLimiterRedis.name === 'MockRateLimiterRedis';

const normalizeRedisUrl = (url) => {
  if (!url) return null;
  let trimmed = url.trim();
  if (trimmed.startsWith('https://')) {
    trimmed = trimmed.replace('https://', 'rediss://');
  } else if (trimmed.startsWith('http://')) {
    trimmed = trimmed.replace('http://', 'redis://');
  } else if (trimmed.startsWith('//')) {
    trimmed = `rediss:${trimmed}`;
  } else if (!trimmed.startsWith('redis://') && !trimmed.startsWith('rediss://')) {
    trimmed = `rediss://${trimmed}`;
  }
  return trimmed;
};

const sanitizedRedisUrl = normalizeRedisUrl(config.redisUrl);

if (isTest && isMock) {
  redisReady = true;
} else if (sanitizedRedisUrl) {
  try {
    redisClient = new Redis(sanitizedRedisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      reconnectOnError: () => false,
      retryStrategy: () => null,
      lazyConnect: isTest,
    });

    redisClient.on('connect', () => {
      redisReady = true;
      logger.info('Connected to Redis for rate limiting.');
    });

    redisClient.on('error', (err) => {
      redisReady = false;
      if (!isTest) {
        logger.warn('Redis connection error. Rate limiting falling back to in-memory store.', err);
      }
    });
  } catch (err) {
    if (!isTest) {
      logger.warn(
        'Failed to initialize Redis client. Rate limiting falling back to in-memory store.',
        err
      );
    }
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

  // Always instantiate RateLimiterRedis in test mode to support late-binding mocks
  if (redisClient || isTest) {
    redisLimiter = new RateLimiterRedis({
      ...options,
      storeClient: redisClient || {},
      inMemoryBlockOnConsumed: points, // Optimize by blocking in memory if fully consumed
    });
  }

  return async (key) => {
    // Evaluate dynamically at runtime to handle Jest module caching of the mock class
    const isMocked = RateLimiterRedis.name === 'MockRateLimiterRedis';
    if ((redisReady || isMocked) && redisLimiter) {
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
  global: getLimiter(
    'global',
    config.rateLimits.globalMax,
    Math.ceil(config.rateLimits.globalWindowMs / 1000)
  ),
  auth: getLimiter(
    'auth',
    config.rateLimits.authMax,
    Math.ceil(config.rateLimits.authWindowMs / 1000)
  ),
  authIp: getLimiter(
    'authIp',
    config.rateLimits.authIpMax,
    Math.ceil(config.rateLimits.authWindowMs / 1000)
  ),
  authEmail: getLimiter(
    'authEmail',
    config.rateLimits.authEmailMax,
    Math.ceil(config.rateLimits.authWindowMs / 1000)
  ),
  user: getLimiter(
    'user',
    config.rateLimits.userMax,
    Math.ceil(config.rateLimits.userWindowMs / 1000)
  ),
  expensive: getLimiter(
    'expensive',
    config.rateLimits.expensiveMax,
    Math.ceil(config.rateLimits.expensiveWindowMs / 1000)
  ),
  generalDashboard: getLimiter('generalDashboard', 100, 900),
};

// Helper to extract clean client IP
const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown-ip';
};

// Middlewares
const globalLimiter = async (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  let key = getClientIp(req);
  let userId = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const { verifyAccessToken } = require('../utils/token');
      const token = req.headers.authorization.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded && decoded.sub) {
        userId = decoded.sub;
        key = `user:${userId}`;
      }
    } catch {
      // Fallback to IP if token is invalid or expired
    }
  }

  try {
    await limiters.global(key);
    next();
  } catch (rej) {
    handleRejection(key, 'global', req, res, next, rej, userId);
  }
};

const authLimiter = async (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const ip = getClientIp(req);
  const identifier = (req.body?.email || req.body?.studentId || '').trim().toLowerCase();

  try {
    // 1. IP-only check for authentication routes
    try {
      await limiters.authIp(ip);
    } catch (rej) {
      return handleRejection(ip, 'authIp', req, res, next, rej);
    }

    // 2. Identifier checks (if identifier is provided)
    if (identifier) {
      // IP + email combination
      try {
        await limiters.auth(`${ip}:${identifier}`);
      } catch (rej) {
        return handleRejection(`${ip}:${identifier}`, 'authCombined', req, res, next, rej);
      }

      // Email-only brute force prevention
      try {
        await limiters.authEmail(identifier);
      } catch (rej) {
        return handleRejection(identifier, 'authEmail', req, res, next, rej);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};

const userLimiter = async (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const key = req.user && req.user.id ? req.user.id : getClientIp(req);
  try {
    await limiters.user(key);
    next();
  } catch (rej) {
    handleRejection(key, 'user', req, res, next, rej);
  }
};

const expensiveRouteLimiter = async (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const key = req.user && req.user.id ? req.user.id : getClientIp(req);
  try {
    await limiters.expensive(key);
    next();
  } catch (rej) {
    handleRejection(key, 'expensive', req, res, next, rej);
  }
};

const generalDashboardLimiter = async (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const key = getClientIp(req);
  try {
    await limiters.generalDashboard(key);
    next();
  } catch (rej) {
    handleRejection(key, 'generalDashboard', req, res, next, rej);
  }
};

const handleRejection = (key, tierName, req, res, next, rej, userId = null) => {
  if (rej instanceof Error) {
    logger.warn(
      `Rate limiter internal exception on ${tierName} tier: ${rej.message}. Failing open.`
    );
    return next();
  }

  const retryAfterSeconds = rej && rej.msBeforeNext ? Math.ceil(rej.msBeforeNext / 1000) : 60;
  res.setHeader('Retry-After', String(retryAfterSeconds));

  const clientIp = getClientIp(req);
  const activeUserId = userId || (req.user && req.user.id) || null;
  const path = req.originalUrl || req.url;

  logger.warn(
    `Rate limit exceeded. Tier: ${tierName}, Key: ${key}, IP: ${clientIp}, UserID: ${activeUserId || 'unauthenticated'}, Path: ${path}, Retry-After: ${retryAfterSeconds}s`
  );

  return res.status(429).json({
    success: false,
    message: `Too many requests on ${tierName} limiter. Please retry after ${retryAfterSeconds} seconds.`,
    code: 429,
  });
};

const resetAllLimiters = () => {
  limiters.global = getLimiter(
    'global',
    config.rateLimits.globalMax,
    Math.ceil(config.rateLimits.globalWindowMs / 1000)
  );
  limiters.auth = getLimiter(
    'auth',
    config.rateLimits.authMax,
    Math.ceil(config.rateLimits.authWindowMs / 1000)
  );
  limiters.authIp = getLimiter(
    'authIp',
    config.rateLimits.authIpMax,
    Math.ceil(config.rateLimits.authWindowMs / 1000)
  );
  limiters.authEmail = getLimiter(
    'authEmail',
    config.rateLimits.authEmailMax,
    Math.ceil(config.rateLimits.authWindowMs / 1000)
  );
  limiters.user = getLimiter(
    'user',
    config.rateLimits.userMax,
    Math.ceil(config.rateLimits.userWindowMs / 1000)
  );
  limiters.expensive = getLimiter(
    'expensive',
    config.rateLimits.expensiveMax,
    Math.ceil(config.rateLimits.expensiveWindowMs / 1000)
  );
  limiters.generalDashboard = getLimiter('generalDashboard', 100, 900);
};

module.exports = {
  globalLimiter,
  authLimiter,
  userLimiter,
  expensiveRouteLimiter,
  generalDashboardLimiter,
  getLimiter,
  redisClient,
  resetAllLimiters,
  limiters,
};
