process.env.NODE_ENV = 'test';
process.env.TEST_CSRF = 'true';
jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');

const { isAllowedOrigin, safeCompareTokens } = require('../middlewares/csrf');
const { createTestCollege, createTestUser } = require('./helpers/testFactories');
const { generateAccessToken } = require('../utils/token');

describe('CSRF Protection Hardening Test Suite', () => {
  let testCollege;
  let testUser;
  let authToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test');
    }

    testCollege = await createTestCollege({
      name: 'CSRF Test College',
      slug: 'csrf-test-college',
      code: 'CTIC',
    });

    testUser = await createTestUser({
      collegeId: testCollege._id,
      email: 'csrf_tester@example.com',
      password: 'SecurePassword123!',
      role: 'student',
    });

    authToken = generateAccessToken(testUser);
  });

  afterAll(async () => {
    delete process.env.TEST_CSRF;
    try {
      await College.deleteMany({ slug: 'csrf-test-college' });
      await User.deleteMany({ email: 'csrf_tester@example.com' });
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // Best-effort cleanup
    }
  });

  describe('1. CSRF Token Issuance & Cookie Attributes', () => {
    it('should generate a 32-byte hex token and set _csrf cookie with SameSite=lax', async () => {
      const res = await request(app).get('/api/v1/auth/csrf-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.csrfToken).toBeDefined();
      expect(res.body.csrfToken.length).toBe(64); // 32 bytes in hex = 64 characters

      const setCookieHeaders = res.headers['set-cookie'] || [];
      const csrfCookie = setCookieHeaders.find((c) => c.startsWith('_csrf='));
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie.toLowerCase()).toContain('samesite=lax');
      expect(csrfCookie.toLowerCase()).toContain('path=/');
    });
  });

  describe('2. Server-side Origin / Referer Verification', () => {
    it('should allow legitimate requests matching allowed origins or host', () => {
      expect(isAllowedOrigin('http://localhost:5173', 'localhost:5000')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:5173', '127.0.0.1:5000')).toBe(true);
      expect(isAllowedOrigin('https://mit.bookbuddy.com', 'api.bookbuddy.com')).toBe(true);
      expect(isAllowedOrigin('https://book-buddy-eight-rosy.vercel.app', 'api.bookbuddy.com')).toBe(
        true
      );
    });

    it('should reject unauthorized cross-origin requests in isAllowedOrigin', () => {
      expect(isAllowedOrigin('https://evil-attacker.com', 'localhost:5000')).toBe(false);
      expect(isAllowedOrigin('http://phishing-site.org', 'api.bookbuddy.com')).toBe(false);
      expect(isAllowedOrigin('not-a-valid-url', 'localhost:5000')).toBe(false);
    });

    it('should reject state-changing requests from a disallowed Origin with 403', async () => {
      const res = await request(app)
        .post('/api/v1/feed')
        .set('Origin', 'https://evil-attacker.com')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Hostile Post', body: 'Payload' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(
        /Not allowed by CORS|Cross-origin request blocked by CSRF protection/
      );
    });

    it('should reject state-changing requests from a disallowed Referer with 403', async () => {
      const res = await request(app)
        .post('/api/v1/feed')
        .set('Referer', 'https://evil-attacker.com/malicious-link')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Hostile Post', body: 'Payload' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Cross-origin request blocked by CSRF protection');
    });
  });

  describe('3. Double-Submit Token Enforcement', () => {
    it('should accept state-changing request when _csrf cookie matches x-csrf-token header', async () => {
      const tokenRes = await request(app).get('/api/v1/auth/csrf-token');
      const csrfToken = tokenRes.body.csrfToken;
      const cookieVal = `_csrf=${csrfToken}`;

      const res = await request(app)
        .post('/api/v1/feedback')
        .set('Cookie', cookieVal)
        .set('x-csrf-token', csrfToken)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          collegeId: testCollege._id,
          category: 'general',
          message: 'Legitimate patron feedback submitted with valid CSRF token.',
          rating: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject state-changing request when _csrf cookie is present but x-csrf-token header is missing', async () => {
      const tokenRes = await request(app).get('/api/v1/auth/csrf-token');
      const csrfToken = tokenRes.body.csrfToken;
      const cookieVal = `_csrf=${csrfToken}`;

      const res = await request(app)
        .post('/api/v1/feedback')
        .set('Cookie', cookieVal)
        // No x-csrf-token header attached
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          collegeId: testCollege._id,
          category: 'general',
          message: 'Forged request without header token',
          rating: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Invalid or missing CSRF token');
    });

    it('should reject state-changing request when x-csrf-token does not match _csrf cookie', async () => {
      const tokenRes = await request(app).get('/api/v1/auth/csrf-token');
      const csrfToken = tokenRes.body.csrfToken;
      const cookieVal = `_csrf=${csrfToken}`;
      const forgedToken = '0'.repeat(64);

      const res = await request(app)
        .post('/api/v1/feedback')
        .set('Cookie', cookieVal)
        .set('x-csrf-token', forgedToken)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          collegeId: testCollege._id,
          category: 'general',
          message: 'Forged request with mismatched token',
          rating: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Invalid or missing CSRF token');
    });

    it('should safely compare tokens in constant time', () => {
      const tokenA = 'a'.repeat(64);
      const tokenB = 'a'.repeat(64);
      const tokenC = 'b'.repeat(64);
      const tokenD = 'a'.repeat(32);

      expect(safeCompareTokens(tokenA, tokenB)).toBe(true);
      expect(safeCompareTokens(tokenA, tokenC)).toBe(false);
      expect(safeCompareTokens(tokenA, tokenD)).toBe(false);
      expect(safeCompareTokens(null, tokenA)).toBe(false);
      expect(safeCompareTokens(tokenA, undefined)).toBe(false);
    });
  });

  describe('4. Safe Methods & Webhook Signature Exemption', () => {
    it('should allow GET requests without CSRF tokens', async () => {
      const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
    });

    it('should exempt signature-verified webhook endpoints from CSRF token requirement', async () => {
      // POST to payment webhook without CSRF cookie or x-csrf-token
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send({ event: 'payment.captured' });

      // Should bypass CSRF check and proceed to signature verification in controller (returning 400 for missing signature)
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Signature verification failed');
    });
  });
});
