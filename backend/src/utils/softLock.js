const { redisClient } = require('../middlewares/rateLimiters');
const logger = require('./logger');

// In-memory fallback map when Redis is unavailable or during isolated testing
const inMemoryLocks = new Map();

/**
 * Generate standardized key for facility slot lock
 */
const buildLockKey = (resourceId, date, slotStart) => {
  const rId = resourceId ? resourceId.toString() : 'unknown';
  const dStr = date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  const sStr = slotStart instanceof Date ? slotStart.toISOString() : String(slotStart);
  return `facility:lock:${rId}:${dStr}:${sStr}`;
};

/**
 * Check if Redis connection is active and ready
 */
const isRedisReady = () => {
  return redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');
};

/**
 * Attempt to acquire a soft lock on a facility slot with a specified TTL (default 90s)
 * @param {Object} params
 * @param {string|ObjectId} params.resourceId
 * @param {Date|string} params.date
 * @param {Date|string} params.slotStart
 * @param {string|ObjectId} params.studentId
 * @param {number} [params.ttlSeconds=90]
 * @returns {Promise<{ success: boolean, holder?: string, refreshed?: boolean, lockKey: string, message?: string }>}
 */
const acquireSoftLock = async ({ resourceId, date, slotStart, studentId, ttlSeconds = 90 }) => {
  const lockKey = buildLockKey(resourceId, date, slotStart);
  const studentIdStr = studentId.toString();

  if (isRedisReady()) {
    try {
      // Try to acquire exclusively with TTL
      const res = await redisClient.set(lockKey, studentIdStr, 'EX', ttlSeconds, 'NX');
      if (res === 'OK') {
        return { success: true, lockKey, ttlSeconds };
      }

      // If key already exists, check if held by the same student
      const currentHolder = await redisClient.get(lockKey);
      if (currentHolder === studentIdStr) {
        // Refresh lock TTL for the current student
        await redisClient.expire(lockKey, ttlSeconds);
        return { success: true, lockKey, ttlSeconds, refreshed: true };
      }

      return {
        success: false,
        lockKey,
        holder: currentHolder,
        message: 'This slot is temporarily held by another student. Please check back shortly.',
      };
    } catch (err) {
      logger.warn(
        `Redis acquireSoftLock error for ${lockKey}: ${err.message}. Falling back to memory.`
      );
    }
  }

  // In-Memory Fallback
  const now = Date.now();
  const existing = inMemoryLocks.get(lockKey);

  if (existing) {
    if (now < existing.expiresAt) {
      if (existing.studentId === studentIdStr) {
        existing.expiresAt = now + ttlSeconds * 1000;
        return { success: true, lockKey, ttlSeconds, refreshed: true };
      }
      return {
        success: false,
        lockKey,
        holder: existing.studentId,
        message: 'This slot is temporarily held by another student. Please check back shortly.',
      };
    }
    // Expired lock
    inMemoryLocks.delete(lockKey);
  }

  inMemoryLocks.set(lockKey, {
    studentId: studentIdStr,
    expiresAt: now + ttlSeconds * 1000,
  });

  return { success: true, lockKey, ttlSeconds };
};

/**
 * Release a held soft lock if owned by the requesting student (or forced by admin)
 * @param {Object} params
 * @param {string|ObjectId} params.resourceId
 * @param {Date|string} params.date
 * @param {Date|string} params.slotStart
 * @param {string|ObjectId} [params.studentId] If omitted, releases regardless of holder
 * @returns {Promise<boolean>}
 */
const releaseSoftLock = async ({ resourceId, date, slotStart, studentId }) => {
  const lockKey = buildLockKey(resourceId, date, slotStart);
  const studentIdStr = studentId ? studentId.toString() : null;

  if (isRedisReady()) {
    try {
      if (!studentIdStr) {
        await redisClient.del(lockKey);
        return true;
      }
      // Lua script or conditional delete
      const currentHolder = await redisClient.get(lockKey);
      if (currentHolder === studentIdStr) {
        await redisClient.del(lockKey);
        return true;
      }
      return false;
    } catch (err) {
      logger.warn(
        `Redis releaseSoftLock error for ${lockKey}: ${err.message}. Falling back to memory.`
      );
    }
  }

  // In-Memory Fallback
  const existing = inMemoryLocks.get(lockKey);
  if (!existing) return true;

  if (!studentIdStr || existing.studentId === studentIdStr) {
    inMemoryLocks.delete(lockKey);
    return true;
  }

  return false;
};

/**
 * Get current lock holder if active
 */
const getSoftLockHolder = async ({ resourceId, date, slotStart }) => {
  const lockKey = buildLockKey(resourceId, date, slotStart);

  if (isRedisReady()) {
    try {
      return await redisClient.get(lockKey);
    } catch (err) {
      logger.warn(`Redis getSoftLockHolder error: ${err.message}`);
    }
  }

  const existing = inMemoryLocks.get(lockKey);
  if (!existing) return null;
  if (Date.now() >= existing.expiresAt) {
    inMemoryLocks.delete(lockKey);
    return null;
  }
  return existing.studentId;
};

/**
 * Clear all soft locks in memory (for test teardowns)
 */
const clearAllInMemoryLocks = () => {
  inMemoryLocks.clear();
};

module.exports = {
  buildLockKey,
  acquireSoftLock,
  releaseSoftLock,
  getSoftLockHolder,
  clearAllInMemoryLocks,
};
