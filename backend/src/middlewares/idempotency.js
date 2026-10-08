const NodeCache = require('node-cache');
const { redisClient } = require('./rateLimiters');
const AppError = require('../utils/AppError');

// Memory fallback cache (TTL 24 hours = 86400s)
const memoryCache = new NodeCache({ stdTTL: 86400 });

/**
 * Idempotency middleware storing response per Idempotency-Key header for 24h.
 */
const requireIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  if (!idempotencyKey) {
    return next(
      new AppError('Idempotency-Key header is required for this financial transaction.', 400)
    );
  }

  const cacheKey = `idempotency:${idempotencyKey}`;

  // 1. Check for cached response
  let cachedData = null;
  if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
    try {
      const raw = await redisClient.get(cacheKey);
      if (raw) cachedData = JSON.parse(raw);
    } catch {
      cachedData = memoryCache.get(cacheKey);
    }
  } else {
    cachedData = memoryCache.get(cacheKey);
  }

  if (cachedData) {
    if (cachedData.inFlight) {
      return next(
        new AppError(
          'A request with this Idempotency-Key is currently in progress. Please wait.',
          409
        )
      );
    }
    res.setHeader('X-Cache-Lookup', 'HIT-Idempotency');
    return res.status(cachedData.statusCode).json(cachedData.body);
  }

  // 2. Mark in-flight to prevent concurrent double-submits
  const inFlightPayload = { inFlight: true, timestamp: Date.now() };
  if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
    await redisClient.set(cacheKey, JSON.stringify(inFlightPayload), 'EX', 60).catch(() => {});
  } else {
    memoryCache.set(cacheKey, inFlightPayload, 60);
  }

  // Clear in-flight lock if request closes unexpectedly before finishing
  res.on('close', () => {
    if (!res.headersSent) {
      if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
        redisClient.del(cacheKey).catch(() => {});
      } else {
        memoryCache.del(cacheKey);
      }
    }
  });

  // 3. Intercept res.json to capture response for caching
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Release in-flight lock without caching on transient 5xx server failures
    if (res.statusCode >= 500) {
      if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
        redisClient.del(cacheKey).catch(() => {});
      } else {
        memoryCache.del(cacheKey);
      }
      return originalJson(body);
    }

    const responsePayload = {
      statusCode: res.statusCode,
      body,
    };

    if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
      redisClient.set(cacheKey, JSON.stringify(responsePayload), 'EX', 86400).catch(() => {});
    } else {
      memoryCache.set(cacheKey, responsePayload);
    }

    return originalJson(body);
  };

  next();
};

module.exports = requireIdempotency;
