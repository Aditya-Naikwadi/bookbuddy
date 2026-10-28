const crypto = require('crypto');
const CronJobLock = require('../models/CronJobLock');
const logger = require('./logger');

const instanceId =
  process.env.INSTANCE_ID ||
  process.env.PM2_ID ||
  `node_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;

/**
 * Attempts to acquire an exclusive distributed lease for a job or shared resource.
 * Tries Redis first (O(1)), falling back to MongoDB atomic leases if Redis is unavailable.
 *
 * @param {string} resourceName - Unique identifier for the job or resource
 * @param {number} ttlSeconds - Duration for which the lock remains valid (default 300s)
 * @returns {Promise<{ acquired: boolean, provider: 'redis'|'mongodb'|null, lockToken: string|null, lockKey: string }>}
 */
const acquireLock = async (resourceName, ttlSeconds = 300) => {
  const lockToken = `${instanceId}:${Date.now()}:${crypto.randomBytes(6).toString('hex')}`;
  const sanitizedKey = resourceName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const redisLockKey = `lock:cron:${sanitizedKey}`;

  // 1. Try Redis first if connected
  let redisClient = null;
  try {
    const rateLimiters = require('../middlewares/rateLimiters');
    redisClient = rateLimiters.redisClient;
  } catch {
    // Non-blocking fallback
  }

  const isRedisReady =
    redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');

  if (isRedisReady) {
    try {
      const result = await redisClient.set(redisLockKey, lockToken, 'EX', ttlSeconds, 'NX');
      if (result === 'OK') {
        return { acquired: true, provider: 'redis', lockToken, lockKey: redisLockKey };
      }
      return { acquired: false, provider: 'redis', lockToken: null, lockKey: redisLockKey };
    } catch (err) {
      logger.warn(
        `Redis lock acquisition failed for ${resourceName}: ${err.message}. Falling back to MongoDB.`
      );
    }
  }

  // 2. Fallback to MongoDB atomic lease
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const doc = await CronJobLock.findOneAndUpdate(
      {
        jobName: resourceName,
        $or: [{ expiresAt: { $lte: now } }, { lockedBy: lockToken }],
      },
      {
        $set: {
          lockedBy: lockToken,
          lockedAt: now,
          expiresAt,
        },
      },
      { returnDocument: 'after' }
    );

    if (doc) {
      return { acquired: true, provider: 'mongodb', lockToken, lockKey: resourceName };
    }

    // If no document exists yet, create one atomically
    try {
      await CronJobLock.create({
        jobName: resourceName,
        lockedBy: lockToken,
        lockedAt: now,
        expiresAt,
      });
      return { acquired: true, provider: 'mongodb', lockToken, lockKey: resourceName };
    } catch (createErr) {
      if (createErr.code === 11000) {
        // Another instance created the document concurrently and holds the lock
        return { acquired: false, provider: 'mongodb', lockToken: null, lockKey: resourceName };
      }
      throw createErr;
    }
  } catch (mongoErr) {
    logger.error(`MongoDB lock acquisition failed for ${resourceName}: ${mongoErr.message}`);
    return { acquired: false, provider: null, lockToken: null, lockKey: resourceName };
  }
};

/**
 * Releases a distributed lease if the token matches.
 *
 * @param {string} resourceName
 * @param {string} lockToken
 * @param {'redis'|'mongodb'} provider
 * @param {string} [lockKey]
 */
const releaseLock = async (resourceName, lockToken, provider = 'redis', lockKey = null) => {
  if (!lockToken) return;

  if (provider === 'redis') {
    const sanitizedKey =
      lockKey || `lock:cron:${resourceName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    let redisClient = null;
    try {
      const rateLimiters = require('../middlewares/rateLimiters');
      redisClient = rateLimiters.redisClient;
    } catch {
      // Non-blocking
    }
    const isRedisReady =
      redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');
    if (isRedisReady) {
      try {
        const currentToken = await redisClient.get(sanitizedKey);
        if (currentToken === lockToken) {
          await redisClient.del(sanitizedKey);
        }
      } catch (err) {
        logger.warn(`Redis lock release failed for ${resourceName}: ${err.message}`);
      }
    }
  } else if (provider === 'mongodb') {
    try {
      await CronJobLock.deleteOne({ jobName: resourceName, lockedBy: lockToken });
    } catch (err) {
      logger.warn(`MongoDB lock release failed for ${resourceName}: ${err.message}`);
    }
  }
};

module.exports = {
  acquireLock,
  releaseLock,
};
