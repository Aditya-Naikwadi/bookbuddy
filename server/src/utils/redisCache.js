const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

let redisClient = null;
let isConnected = false;

if (config.redisUrl || process.env.NODE_ENV !== 'test') {
  try {
    redisClient = new Redis(config.redisUrl || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
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
