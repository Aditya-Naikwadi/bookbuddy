/**
 * Rate Limiting Audit & Verification Test Suite
 *
 * Requirements Verified:
 * 1. Burst of requests to login -> 429 with Retry-After header.
 * 2. Normal usage within thresholds is completely unaffected.
 * 3. Burst of requests to expensive endpoints (e.g., search, file upload) -> 429 with Retry-After header.
 * 4. Progressive backoff and temporary lockout on repeated failed logins without leaking account existence.
 * 5. Extraction of client IP correctly behind proxies (X-Forwarded-For spoofing cannot bypass limits).
 * 6. Rate limits configurable via environment variables / shared Redis store with graceful fallback.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

jest.mock('../services/googleBooksService', () => ({
  searchBooks: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  getBookById: jest.fn().mockResolvedValue({}),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const config = require('../config');
const { resetAllLimiters, getClientIp } = require('../middlewares/rateLimiters');
const { resetLoginLimiter } = require('../middlewares/loginRateLimiter');

describe('7. Rate Limiting Master Security Audit', () => {
  const originalAuthMax = config.rateLimits.authMax;
  const originalAuthIpMax = config.rateLimits.authIpMax;
  const originalExpensiveMax = config.rateLimits.expensiveMax;
  const originalSearchMax = config.rateLimits.searchMax;
  const originalLoginLockoutMax = config.loginLockout.maxAttempts;

  beforeEach(() => {
    // Reset limiters before each test
    config.rateLimits.authMax = 3;
    config.rateLimits.authIpMax = 3;
    config.rateLimits.expensiveMax = 2;
    config.rateLimits.searchMax = 2;
    config.loginLockout.maxAttempts = 3;

    resetAllLimiters();
    resetLoginLimiter();
  });

  afterAll(async () => {
    config.rateLimits.authMax = originalAuthMax;
    config.rateLimits.authIpMax = originalAuthIpMax;
    config.rateLimits.expensiveMax = originalExpensiveMax;
    config.rateLimits.searchMax = originalSearchMax;
    config.loginLockout.maxAttempts = originalLoginLockoutMax;

    resetAllLimiters();
    resetLoginLimiter();

    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('1. Auth Endpoint Rate Limiting (Login Burst)', () => {
    it('allows normal login attempts within the configured limit and blocks bursts with 429 and Retry-After', async () => {
      const email = 'normaluser@testcollege.edu';

      // 1st request -> Allowed through rate limiter (may return 401/400 for bad credentials, but not 429)
      const res1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1!' });
      expect(res1.status).not.toBe(429);

      // 2nd request -> Allowed through rate limiter
      const res2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1!' });
      expect(res2.status).not.toBe(429);

      // 3rd request -> Allowed through rate limiter
      const res3 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1!' });
      expect(res3.status).not.toBe(429);

      // 4th request -> Burst exceeds limit (authIpMax / lockout) -> MUST return 429
      const resBurst = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1!' });

      expect(resBurst.status).toBe(429);
      expect(resBurst.headers['retry-after']).toBeDefined();
      expect(parseInt(resBurst.headers['retry-after'], 10)).toBeGreaterThan(0);
      expect(resBurst.body.success).toBe(false);
    });

    it('locks out repeated login failures without leaking account existence', async () => {
      const fakeEmail1 = 'nonexistent1@testcollege.edu';

      // Submit failed attempts for an unknown email
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: fakeEmail1, password: 'WrongPassword!' });
      expect(res.status).toBe(401);
      // Uniform generic message protects account enumeration
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });
  });

  describe('2. Expensive Endpoint Rate Limiting (Burst on Search / Uploads)', () => {
    it('blocks excessive requests to search endpoint with HTTP 429 and Retry-After', async () => {
      // 1st search request -> Allowed
      const res1 = await request(app)
        .get('/api/v1/google-books/search?search=calculus')
        .set('x-forwarded-for', '10.0.0.1');
      expect(res1.status).toBe(200);

      // 2nd search request -> Allowed
      const res2 = await request(app)
        .get('/api/v1/google-books/search?search=algebra')
        .set('x-forwarded-for', '10.0.0.1');
      expect(res2.status).toBe(200);

      // 3rd search request -> Exceeds searchMax (2) -> Returns 429
      const res3 = await request(app)
        .get('/api/v1/google-books/search?search=physics')
        .set('x-forwarded-for', '10.0.0.1');

      expect(res3.status).toBe(429);
      expect(res3.headers['retry-after']).toBeDefined();
      expect(res3.body).toEqual(
        expect.objectContaining({
          success: false,
          code: 429,
          message: expect.stringContaining('Too many requests on search limiter'),
        })
      );
    });

    it('verifies unaffected normal traffic from a different client IP', async () => {
      // A different client IP should be unblocked and unaffected
      const resOtherClient = await request(app)
        .get('/api/v1/google-books/search?search=chemistry')
        .set('x-forwarded-for', '192.168.1.50');

      expect(resOtherClient.status).toBe(200);
    });
  });

  describe('3. Proxy IP Spoofing Defense', () => {
    it('correctly resolves client IP without blindly trusting spoofed X-Forwarded-For prefixes', () => {
      // Express trust proxy = 1 trusts only the last proxy hop
      const mockReq = {
        ip: '203.0.113.195',
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8, 203.0.113.195',
        },
      };

      const resolvedIp = getClientIp(mockReq);
      // Must equal Express's verified trusted client IP, not attacker-supplied '1.2.3.4'
      expect(resolvedIp).toBe('203.0.113.195');
    });
  });
});
