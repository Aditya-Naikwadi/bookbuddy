/**
 * AppSec Test Suite: Patron Card Gate Verification Security
 *
 * Agent: @security-appsec-engineer
 *
 * Verifies:
 * 1. Unauthenticated requests are rejected (HTTP 401).
 * 2. Invalid scanner API keys are rejected (HTTP 401).
 * 3. Valid scanner API keys (x-api-key, x-scanner-key, Authorization: ApiKey) are authorized (HTTP 200).
 * 4. Non-staff student accounts with Bearer tokens are rejected (HTTP 403 Forbidden).
 * 5. Staff-role accounts (college-admin, super-admin, librarian) with Bearer tokens are authorized (HTTP 200).
 * 6. Rate limiting enforces request limits and returns HTTP 429 with Retry-After header.
 */

process.env.NODE_ENV = 'test';
process.env.SCANNER_API_KEY = 'test-scanner-secure-gate-key-xyz';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');
const { generatePatronToken } = require('../utils/patronTokenUtil');
const { resetAllLimiters, limiters } = require('../middlewares/rateLimiters');

describe('@security-appsec-engineer: Patron Card Gate Verification Security Suite', () => {
  let testCollege;
  let studentUser;
  let staffAdminUser;
  let superAdminUser;
  let studentToken;
  let staffAdminToken;
  let superAdminToken;
  let validQrToken;
  const SCANNER_KEY = 'test-scanner-secure-gate-key-xyz';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    testCollege = await College.create({
      name: 'Security Gate Institute',
      code: 'SGI_' + unique.replace('-', '_'),
      slug: 'sgi-' + unique,
      status: 'active',
    });

    studentUser = await User.create({
      studentId: 'STU_SEC_001',
      name: 'Security Student',
      email: `student_${unique}@sgi.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
      membershipStatus: 'active',
    });

    staffAdminUser = await User.create({
      studentId: `ADM_${unique}`,
      name: 'Gate Staff Admin',
      email: `admin_${unique}@sgi.edu`,
      password: 'Password123!',
      role: 'college-admin',
      collegeId: testCollege._id,
      status: 'active',
    });

    superAdminUser = await User.create({
      studentId: `SUP_${unique}`,
      name: 'Platform Super Admin',
      email: `super_${unique}@bookbuddy.com`,
      password: 'Password123!',
      role: 'super-admin',
      status: 'active',
    });

    studentToken = generateAccessToken(studentUser);
    staffAdminToken = generateAccessToken(staffAdminUser);
    superAdminToken = generateAccessToken(superAdminUser);

    const generated = generatePatronToken(studentUser._id, studentUser.studentId);
    validQrToken = generated.token;
  });

  beforeEach(() => {
    resetAllLimiters();
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await User.deleteMany({ collegeId: testCollege._id });
        await User.deleteMany({ _id: superAdminUser._id });
        await College.deleteMany({ _id: testCollege._id });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('1. Authentication Gatekeeping', () => {
    it('rejects unauthenticated requests with HTTP 401 when no credentials are provided', async () => {
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    it('rejects requests with an invalid scanner API key with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .set('x-api-key', 'invalid-fake-scanner-key')
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid scanner API key/i);
    });

    it('rejects requests with a student Bearer token with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(
        /Forbidden: Access restricted to authorized library gate scanners and staff/i
      );
    });
  });

  describe('2. Authorized Access: Scanner API Key', () => {
    it('authenticates and verifies successfully using x-api-key header', async () => {
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .set('x-api-key', SCANNER_KEY)
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.studentId.toLowerCase()).toBe('stu_sec_001');
      expect(res.body.data.name).toBe('Security Student');
    });

    it('authenticates and verifies successfully using x-scanner-key header', async () => {
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .set('x-scanner-key', SCANNER_KEY)
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
    });

    it('authenticates and verifies successfully using Authorization: ApiKey scheme', async () => {
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .set('Authorization', `ApiKey ${SCANNER_KEY}`)
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
    });
  });

  describe('3. Authorized Access: Staff Roles', () => {
    it('authenticates and verifies successfully using college-admin Bearer token', async () => {
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .set('Authorization', `Bearer ${staffAdminToken}`)
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.studentId.toLowerCase()).toBe('stu_sec_001');
    });

    it('authenticates and verifies successfully using super-admin Bearer token', async () => {
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
    });
  });

  describe('4. Rate Limiting Enforcement', () => {
    it('enforces rate limit on POST /patron-card/verify and returns HTTP 429 with Retry-After header', async () => {
      // Consume all available points on patronCardVerify limiter for this IP
      const testKey = 'scanner:spam-test-key';
      for (let i = 0; i < 65; i++) {
        try {
          await limiters.patronCardVerify(testKey);
        } catch {
          break;
        }
      }

      // Now send a request with that key
      const res = await request(app)
        .post('/api/v1/patron-card/verify')
        .set('x-api-key', 'spam-test-key')
        .send({ token: validQrToken });

      expect(res.statusCode).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
    });
  });
});
