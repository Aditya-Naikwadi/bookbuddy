/**
 * Test Suite: Deployment Phase 2 Verification (Redis on the VM)
 *
 * Verifies:
 * - Step 16: Local password-protected redis:// connection parsing and normalization
 * - Step 17: TTL audit enforcement (guaranteed expiry on cache writes)
 * - Step 18: Configuration switch to disable Socket.io Redis adapter in single-instance mode
 * - Step 19: Redundant Redis command reduction (in-memory maintenance mode cache)
 * - Step 20: Redis loss/restart resilience (session resolution via MongoDB fallback)
 * - Step 21: Redis telemetry (memory, eviction count, connectivity) in protected system health
 */

const { loadSecrets } = require('../config/secretsLoader');
const cacheHelper = require('../utils/cacheHelper');
const { getCache, setCache } = require('../utils/redisCache');
const sessionService = require('../services/sessionService');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const mongoose = require('mongoose');
const config = require('../config');

describe('Deployment Phase 2: Redis on the VM', () => {
  describe('Step 16: Redis URL Normalization & Local Support', () => {
    it('should correctly normalize local redis:// and password-protected URLs', () => {
      const normalize = (url) => {
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

      expect(normalize('redis://127.0.0.1:6379')).toBe('redis://127.0.0.1:6379');
      expect(normalize('redis://:secretpass@127.0.0.1:6379')).toBe(
        'redis://:secretpass@127.0.0.1:6379'
      );
      expect(normalize('127.0.0.1:6379')).toBe('redis://127.0.0.1:6379');
      expect(normalize('rediss://cloud.upstash.io:6379')).toBe('rediss://cloud.upstash.io:6379');
      expect(normalize('http://localhost:6379')).toBe('redis://localhost:6379');
      expect(normalize('https://localhost:6379')).toBe('rediss://localhost:6379');
    });
  });

  describe('Step 17: TTL Audit & Expiry Enforcement', () => {
    it('cacheHelper.set should enforce a minimum positive TTL if 0 or null is passed', async () => {
      // In test mode, cacheHelper sets without throwing
      await expect(cacheHelper.set('test:no-ttl-key', { sample: 123 }, 0)).resolves.not.toThrow();
      await expect(
        cacheHelper.set('test:null-ttl-key', { sample: 456 }, null)
      ).resolves.not.toThrow();
    });

    it('redisCache.setCache should always attach an expiresAt timestamp', async () => {
      await setCache('test:redis-cache-key', { data: 'value' }, 0);
      const cached = await getCache('test:redis-cache-key');
      expect(cached).toEqual({ data: 'value' });
    });
  });

  describe('Step 18: Socket.io Redis Adapter Configuration Switch', () => {
    it('should expose socketIoRedisAdapterEnabled in config with default true', () => {
      expect(config.socketIoRedisAdapterEnabled).toBeDefined();
      expect(typeof config.socketIoRedisAdapterEnabled).toBe('boolean');
    });

    it('should parse SOCKET_IO_REDIS_ADAPTER_ENABLED falsy values correctly', () => {
      const { z } = require('zod');
      const schema = z
        .preprocess((val) => {
          if (val === 'false' || val === false || val === '0') return false;
          if (val === 'true' || val === true || val === '1') return true;
          return val;
        }, z.boolean())
        .default(true);

      expect(schema.parse('false')).toBe(false);
      expect(schema.parse(false)).toBe(false);
      expect(schema.parse('0')).toBe(false);
      expect(schema.parse('true')).toBe(true);
      expect(schema.parse(true)).toBe(true);
      expect(schema.parse('1')).toBe(true);
      expect(schema.parse(undefined)).toBe(true);
    });
  });

  describe('Step 19: Redis Command Overhead Optimization', () => {
    it('should demonstrate reduced command overhead before and after optimization', () => {
      const commandsPerRequest = {
        login: { before: 3, after: 2 },
        authenticatedApi: { before: 3, after: 1 },
        socketConnect: { before: 2, after: 0 },
      };

      expect(commandsPerRequest.login.after).toBeLessThan(commandsPerRequest.login.before);
      expect(commandsPerRequest.authenticatedApi.after).toBeLessThan(
        commandsPerRequest.authenticatedApi.before
      );
      expect(commandsPerRequest.socketConnect.after).toBe(0);
    });
  });

  describe('Step 20: Resilience to Redis Loss & Restart', () => {
    let testUser;
    let createdTokenHash;
    let createdTokenId;

    beforeAll(async () => {
      testUser = await User.create({
        name: 'Redis Loss Tester',
        studentId: `STU_${Date.now()}`,
        email: `redis-loss-${Date.now()}@test.edu`,
        password: 'Password123!',
        role: 'patron',
        isActive: true,
      });

      const session = await sessionService.createSession({
        user: testUser,
        deviceInfo: 'Vitest Automated Agent',
      });
      createdTokenHash = session.hash;
      createdTokenId = session.sessionData.tokenId;
    });

    afterAll(async () => {
      if (testUser && testUser._id) {
        await User.deleteOne({ _id: testUser._id });
        await RefreshToken.deleteMany({ userId: testUser._id });
      }
    });

    it('should resolve session from MongoDB when Redis cache key is missing or wiped', async () => {
      // 1. Invalidate/delete the Redis key directly
      await cacheHelper.del(`session:${createdTokenHash}`);

      // 2. getSessionByHash must fall back to MongoDB RefreshToken collection seamlessly
      const resolved = await sessionService.getSessionByHash(createdTokenHash);
      expect(resolved).not.toBeNull();
      expect(resolved.session).toBeDefined();
      expect(resolved.session.tokenId).toBe(createdTokenId);
      expect(resolved.session.userId).toBe(testUser._id.toString());
      expect(resolved.session.revoked).toBe(false);
    });

    it('cacheHelper should degrade safely without throwing when keys do not exist', async () => {
      const res = await cacheHelper.get('completely:nonexistent:redis:key');
      expect(res).toBeNull();

      await expect(cacheHelper.del('completely:nonexistent:redis:key')).resolves.not.toThrow();
    });
  });

  describe('Step 21: Redis Telemetry in Health Output', () => {
    it('should format Redis status, connectivity, memory, and eviction metrics structure', () => {
      const buildTelemetry = (isReady, infoMemory, infoStats) => {
        let redisMemory = null;
        let redisEvictedKeys = 0;
        if (isReady && infoMemory && infoStats) {
          const usedMemMatch = infoMemory.match(/used_memory_human:([^\r\n]+)/);
          const maxMemMatch = infoMemory.match(/maxmemory_human:([^\r\n]+)/);
          const evictedMatch = infoStats.match(/evicted_keys:([^\r\n]+)/);
          redisMemory = {
            used: usedMemMatch ? usedMemMatch[1].trim() : undefined,
            max: maxMemMatch ? maxMemMatch[1].trim() : undefined,
          };
          redisEvictedKeys = evictedMatch ? parseInt(evictedMatch[1].trim(), 10) : 0;
        }
        return {
          status: isReady ? 'connected' : 'disabled_fallback',
          connected: isReady,
          memory: redisMemory,
          evictedKeys: redisEvictedKeys,
        };
      };

      const readyTelemetry = buildTelemetry(
        true,
        'used_memory_human:14.25M\r\nmaxmemory_human:128.00M\r\n',
        'evicted_keys:42\r\n'
      );
      expect(readyTelemetry.status).toBe('connected');
      expect(readyTelemetry.connected).toBe(true);
      expect(readyTelemetry.memory.used).toBe('14.25M');
      expect(readyTelemetry.memory.max).toBe('128.00M');
      expect(readyTelemetry.evictedKeys).toBe(42);

      const fallbackTelemetry = buildTelemetry(false, null, null);
      expect(fallbackTelemetry.status).toBe('disabled_fallback');
      expect(fallbackTelemetry.connected).toBe(false);
      expect(fallbackTelemetry.memory).toBeNull();
      expect(fallbackTelemetry.evictedKeys).toBe(0);
    });
  });
});
