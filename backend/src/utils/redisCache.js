const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

let redisClient = null;
let isConnected = false;

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

const rawRedisUrl =
  config.redisUrl || (process.env.NODE_ENV !== 'test' ? 'redis://127.0.0.1:6379' : null);
const targetRedisUrl = normalizeRedisUrl(rawRedisUrl);

if (targetRedisUrl) {
  try {
    const isTls = targetRedisUrl.startsWith('rediss://');
    redisClient = new Redis(targetRedisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      retryStrategy: (times) => {
        if (times > 5) return null; // Stop retrying after 5 attempts to allow graceful in-memory fallback
        return Math.min(times * 500, 3000);
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('Connected to Redis cache.');
    });

    redisClient.on('error', (err) => {
      if (isConnected) {
        logger.warn(`⚠️ Redis Cache Connection Warning [${err.code || 'UNKNOWN'}]: ${err.message}`);
      }
      isConnected = false;
    });

    redisClient.connect().catch((err) => {
      isConnected = false;
      logger.warn(
        `⚠️ Redis Initial Connection Failed [${err.code || 'UNKNOWN'}]: ${err.message}. Using in-memory fallback.`
      );
    });
  } catch (err) {
    isConnected = false;
    logger.warn(`⚠️ Redis Client Creation Error: ${err.message}. Using in-memory fallback.`);
  }
}

const memoryStore = new Map();

const getCache = async (key) => {
  if (!key) return null;
  if (isConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.warn(`⚠️ Redis getCache error for key "${key}": ${err.message}`);
    }
  }
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiresAt && item.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
};

const setCache = async (key, value, ttlSeconds = 300) => {
  if (!key) return false;
  if (isConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn(`⚠️ Redis setCache error for key "${key}": ${err.message}`);
    }
  }
  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
  return true;
};

const deleteCache = async (keyPattern) => {
  if (!keyPattern) return false;
  if (isConnected && redisClient) {
    try {
      const keys = await redisClient.keys(keyPattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (err) {
      logger.warn(`⚠️ Redis deleteCache error for pattern "${keyPattern}": ${err.message}`);
    }
  }
  if (keyPattern.includes('*')) {
    const regex = new RegExp('^' + keyPattern.replace(/\*/g, '.*') + '$');
    for (const k of memoryStore.keys()) {
      if (regex.test(k)) {
        memoryStore.delete(k);
      }
    }
  } else {
    memoryStore.delete(keyPattern);
  }
  return true;
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
};
