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
    redisClient = new Redis(targetRedisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: () => null,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('Connected to Redis cache.');
    });

    redisClient.on('error', (_err) => {
      isConnected = false;
    });

    redisClient.connect().catch(() => {
      isConnected = false;
    });
  } catch {
    isConnected = false;
  }
}

const getCache = async (key) => {
  if (!isConnected || !redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const setCache = async (key, value, ttlSeconds = 300) => {
  if (!isConnected || !redisClient) return false;
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return true;
  } catch {
    return false;
  }
};

const deleteCache = async (keyPattern) => {
  if (!isConnected || !redisClient) return false;
  try {
    const keys = await redisClient.keys(keyPattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
};
