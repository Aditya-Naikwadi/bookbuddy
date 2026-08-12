const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { redisClient } = require('../middlewares/rateLimiters');

describe('Post-Push Deployment Verification Automated Tests', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(async () => {
    try {
      if (redisClient && typeof redisClient.quit === 'function') {
        await redisClient.quit();
      }
    } catch (_err) {
      // Ignore disconnect errors
    }
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch (_err) {
      // Ignore disconnect errors
    }
  });

  it('1. GET /version should return HTTP 200 with commitSha, version, and uptime', async () => {
    process.env.COMMIT_SHA = 'a1b2c3d4e5f6789012345678901234567890abcd';
    process.env.APP_VERSION = '2.5.0';

    const res = await request(app).get('/version');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ok');
    expect(res.body.commitSha).toBe('a1b2c3d4e5f6789012345678901234567890abcd');
    expect(res.body.shortCommitSha).toBe('a1b2c3d');
    expect(res.body.version).toBe('2.5.0');
    expect(res.body.uptime).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it('2. GET /api/v1/version alias route should return same commit metadata', async () => {
    process.env.COMMIT_SHA = 'ff99887766554433221100';

    const res = await request(app).get('/api/v1/version');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.commitSha).toBe('ff99887766554433221100');
    expect(res.body.shortCommitSha).toBe('ff99887');
  });

  it('3. GET /health should include commitSha, shortCommitSha, and version in payload', async () => {
    process.env.COMMIT_SHA = 'abcdef123456789';

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.commitSha).toBe('abcdef123456789');
    expect(res.body.shortCommitSha).toBe('abcdef1');
    expect(res.body.version).toBeDefined();
  });

  it('4. GET /version should be accessible without CSRF or Rate Limit headers', async () => {
    const res = await request(app).get('/version').set('x-csrf-token', '');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
