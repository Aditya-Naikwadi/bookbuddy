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
    trimmed = `redis://${trimmed}`;
  }
  return trimmed;
};

const rawRedisUrl =
  config.redisUrl || (process.env.NODE_ENV !== 'test' ? 'redis://127.0.0.1:6379' : null);
const targetRedisUrl = normalizeRedisUrl(rawRedisUrl);

if (targetRedisUrl) {
  try {
    const isTls = targetRedisUrl.startsWith('rediss://');
    const isTest = process.env.NODE_ENV === 'test';
    redisClient = new Redis(targetRedisUrl, {
      maxRetriesPerRequest: isTest ? 1 : 3,
      connectTimeout: isTest ? 2000 : 10000,
      enableKeepAlive: true,
      keepAlive: 10000,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      reconnectOnError: (err) => {
        if (isTest) return false;
        const targetErrors = ['READONLY', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'];
        if (
          targetErrors.some((target) => (err.message || '').includes(target) || err.code === target)
        ) {
          return 1;
        }
        return false;
      },
      retryStrategy: (times) => {
        if (isTest) return null;
        return Math.min(times * 200, 3000);
      },
      lazyConnect: isTest,
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('Connected to Redis cache.');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    redisClient.on('error', (err) => {
      if (isConnected) {
        logger.warn(`⚠️ Redis Cache Connection Warning [${err.code || 'UNKNOWN'}]: ${err.message}`);
      }
      isConnected = false;
    });

    if (!isTest) {
      const keepAliveHeartbeat = setInterval(async () => {
        try {
          if (redisClient && redisClient.status === 'ready') {
            await redisClient.ping();
          }
        } catch (_) {
          // Handled by ioredis reconnect
        }
      }, 25000);
      keepAliveHeartbeat.unref();
    }

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
  const ttl = ttlSeconds && Number(ttlSeconds) > 0 ? Number(ttlSeconds) : 300;
  if (isConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      logger.warn(`⚠️ Redis setCache error for key "${key}": ${err.message}`);
    }
  }
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttl * 1000,
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
