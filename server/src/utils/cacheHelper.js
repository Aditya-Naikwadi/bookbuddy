const { redisClient } = require('../middlewares/rateLimiters');
const logger = require('./logger');

/**
 * Robust cache helper supporting graceful degradation.
 * If Redis is disconnected, it falls back direct-to-DB without crashing.
 */
const cacheHelper = {
  /**
   * Reads from Redis cache.
   */
  get: async (key) => {
    try {
      if (redisClient && redisClient.status === 'ready') {
        const cached = await redisClient.get(key);
        if (cached) {
          logger.info(`Cache Hit: ${key}`);
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      logger.warn(`Redis GET cache failure for key ${key}: ${err.message}`);
    }
    return null;
  },

  /**
   * Writes to Redis cache with TTL (seconds).
   */
  set: async (key, value, ttlSeconds = 300) => {
    try {
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        logger.info(`Cache Write: ${key} with TTL ${ttlSeconds}s`);
      }
    } catch (err) {
      logger.warn(`Redis SET cache failure for key ${key}: ${err.message}`);
    }
  },

  /**
   * Evicts a key from Redis cache.
   */
  del: async (key) => {
    try {
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.del(key);
        logger.info(`Cache Invalidate: ${key}`);
      }
    } catch (err) {
      logger.warn(`Redis DEL cache failure for key ${key}: ${err.message}`);
    }
  },

  /**
   * Generates a multi-tenant scoped cache key to prevent cross-tenant collisions.
   */
  makeKey: (collegeId, resource, identifier) => {
    const cId = collegeId || 'global';
    const res = resource || 'generic';
    const id = identifier || 'all';
    return `tenant:${cId}:${res}:${id}`;
  },
};

module.exports = cacheHelper;
