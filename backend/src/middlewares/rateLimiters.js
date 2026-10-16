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

  const limiterFn = async (key) => {
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

  limiterFn.delete = async (key) => {
    if (redisLimiter) {
      try {
        await redisLimiter.delete(key);
      } catch (_err) {
        // Ignore deletion errors (e.g. key non-existent or Redis disconnected)
      }
    }
    try {
      await memoryLimiter.delete(key);
    } catch (_err) {
      // Ignore deletion errors (e.g. key non-existent)
    }
  };

  return limiterFn;
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
  search: getLimiter(
    'search',
    config.rateLimits.searchMax || 30,
    Math.ceil((config.rateLimits.searchWindowMs || 60000) / 1000)
  ),
  generalDashboard: getLimiter('generalDashboard', 100, 900),
  college: getLimiter('collegeRateLimit', 1000, 900),
  patronCardVerify: getLimiter(
    'patronCardVerify',
    config.rateLimits.patronCardVerifyMax || 60,
    Math.ceil((config.rateLimits.patronCardVerifyWindowMs || 60000) / 1000)
  ),
};

// Helper to extract clean client IP safely behind reverse proxies
const getClientIp = (req) => {
  // If req.ip is set (Express trust proxy resolved), use it
  if (req?.ip) {
    return req.ip;
  }
  // If trust proxy is explicitly configured and raw headers exist, extract trusted client IP
  if (config.trustProxy && req?.headers?.['x-forwarded-for']) {
    const list = String(req.headers['x-forwarded-for']).split(',');
    return list[list.length - 1].trim();
  }
  return req?.socket?.remoteAddress || 'unknown-ip';
};

const isSystemProbeRoute = (path) => {
  return [
    '/health',
    '/api/health',
    '/api/v1/health',
    '/version',
    '/api/version',
    '/api/v1/version',
    '/ping',
    '/api/ping',
    '/api/v1/ping',
  ].includes(path);
};

// Middlewares
const globalLimiter = async (req, res, next) => {
  if (isSystemProbeRoute(req.path)) {
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
  if (isSystemProbeRoute(req.path)) {
    return next();
  }

  const rawIdentifier =
    typeof req.body?.email === 'string'
      ? req.body.email
      : typeof req.body?.studentId === 'string'
        ? req.body.studentId
        : '';
  const identifier = rawIdentifier.trim().toLowerCase();
  const ip = getClientIp(req);

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
  if (isSystemProbeRoute(req.path)) {
    return next();
  }

  const ip = getClientIp(req);
  const userKey = req.user && req.user.id ? `user:${req.user.id}` : null;
  const ipKey = `ip:${ip}`;

  try {
    if (userKey) {
      await limiters.user(userKey);
    }
    await limiters.user(ipKey);
    next();
  } catch (rej) {
    handleRejection(userKey || ipKey, 'user', req, res, next, rej);
  }
};

const searchLimiter = async (req, res, next) => {
  if (isSystemProbeRoute(req.path)) {
    return next();
  }

  const ip = getClientIp(req);
  const userKey = req.user && req.user.id ? `user:${req.user.id}` : null;
  const key = userKey || `ip:${ip}`;

  try {
    await limiters.search(key);
    next();
  } catch (rej) {
    handleRejection(key, 'search', req, res, next, rej);
  }
};

const expensiveRouteLimiter = async (req, res, next) => {
  if (isSystemProbeRoute(req.path)) {
    return next();
  }

  // Super-admin platform operators are exempt from the 10 req/min expensive limiter
  if (req.user && (req.user.role === 'super-admin' || req.user.role === 'superadmin')) {
    return next();
  }

  if (!req.user && req.headers.authorization?.startsWith('Bearer ')) {
    try {
      const { verifyAccessToken } = require('../utils/token');
      const token = req.headers.authorization.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded && (decoded.role === 'super-admin' || decoded.role === 'superadmin')) {
        return next();
      }
    } catch {
      // Ignore token decode errors here and continue to normal rate limiting
    }
  }

  const key = req.user && req.user.id ? `user:${req.user.id}` : `ip:${getClientIp(req)}`;
  try {
    await limiters.expensive(key);
    next();
  } catch (rej) {
    handleRejection(key, 'expensive', req, res, next, rej);
  }
};

const generalDashboardLimiter = async (req, res, next) => {
  if (isSystemProbeRoute(req.path)) {
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
    statusCode: 429,
    retryAfterSeconds,
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
  limiters.search = getLimiter(
    'search',
    config.rateLimits.searchMax || 30,
    Math.ceil((config.rateLimits.searchWindowMs || 60000) / 1000)
  );
  limiters.generalDashboard = getLimiter('generalDashboard', 100, 900);
  limiters.college = getLimiter('collegeRateLimit', 1000, 900);
  limiters.patronCardVerify = getLimiter(
    'patronCardVerify',
    config.rateLimits.patronCardVerifyMax || 60,
    Math.ceil((config.rateLimits.patronCardVerifyWindowMs || 60000) / 1000)
  );
};

const patronCardVerifyLimiter = async (req, res, next) => {
  if (isSystemProbeRoute(req.path)) {
    return next();
  }

  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['x-scanner-key'] ||
    req.headers['x-scanner-api-key'] ||
    '';
  const ip = getClientIp(req);
  const key = apiKey ? `scanner:${apiKey}` : `ip:${ip}`;

  try {
    await limiters.patronCardVerify(key);
    next();
  } catch (rej) {
    handleRejection(key, 'patronCardVerify', req, res, next, rej);
  }
};

const collegeRateLimiter = async (req, res, next) => {
  const collegeId =
    req.user?.collegeId || req.tenantId || req.headers['x-college-id'] || req.query?.collegeId;

  if (!collegeId) {
    return next();
  }

  const collegeIdStr = collegeId.toString();

  try {
    await limiters.college(`college:${collegeIdStr}`);
    next();
  } catch (err) {
    if (err instanceof Error) {
      logger.warn(`College rate limiter execution error for tenant ${collegeIdStr}`, err);
      return next();
    }

    const retrySecs = Math.ceil((err.msBeforeNext || 60000) / 1000);
    res.setHeader('Retry-After', String(retrySecs));
    res.status(429).json({
      success: false,
      message:
        'Your institution has exceeded its allocated request quota. Please try again shortly.',
      code: 429,
      statusCode: 429,
      retryAfterSeconds: retrySecs,
    });
  }
};

module.exports = {
  globalLimiter,
  authLimiter,
  userLimiter,
  searchLimiter,
  expensiveRouteLimiter,
  generalDashboardLimiter,
  collegeRateLimiter,
  patronCardVerifyLimiter,
  getClientIp,
  getLimiter,
  redisClient,
  resetAllLimiters,
  limiters,
};
