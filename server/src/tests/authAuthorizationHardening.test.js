const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_auth_test';

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const { generateTokenPair } = require('../utils/token');

describe('Master Prompt 1/3: Authentication, Authorization & Route Protection Hardening', () => {
  let college;
  let studentUser;
  let collegeAdminUser;

  let studentToken;
  let collegeAdminToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await College.deleteMany({});
    await User.deleteMany({});

    college = await College.create({
      name: 'Security Test College',
      code: `SEC_${Date.now()}`,
      isActive: true,
      status: 'active',
    });

    studentUser = await User.create({
      studentId: `STU_${Date.now()}`,
      name: 'Student User',
      email: `student_${Date.now()}@test.com`,
      password: 'StudentPassword123!',
      role: 'student',
      collegeId: college._id,
      isActive: true,
    });

    collegeAdminUser = await User.create({
      studentId: `ADM_${Date.now()}`,
      name: 'College Admin User',
      email: `admin_${Date.now()}@test.com`,
      password: 'AdminPassword123!',
      role: 'college-admin',
      collegeId: college._id,
      isActive: true,
    });

    studentToken = generateTokenPair(studentUser).accessToken;
    collegeAdminToken = generateTokenPair(collegeAdminUser).accessToken;
  });

  describe('1. Backend Security Boundary — requireAuth & requireRole Enforcements', () => {
    it('1.1 Unauthenticated requests return HTTP 401 on protected dashboard endpoints', async () => {
      const studentRes = await request(app).get('/api/dashboards/student/overview');
      expect(studentRes.status).toBe(401);
      expect(studentRes.body.success).toBe(false);

      const adminRes = await request(app).get('/api/dashboards/college-admin/patrons');
      expect(adminRes.status).toBe(401);
      expect(adminRes.body.success).toBe(false);

      const superRes = await request(app).get('/api/dashboards/admin-portal/overview');
      expect(superRes.status).toBe(401);
      expect(superRes.body.success).toBe(false);
    });

    it('1.2 Authenticated requests with invalid/fake tokens return HTTP 401', async () => {
      const res = await request(app)
        .get('/api/dashboards/student/overview')
        .set('Authorization', 'Bearer invalid_fake_token_123');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('1.3 Authenticated requests with wrong role return HTTP 403 on protected routes', async () => {
      // Student attempting to access College Admin endpoint
      const studentToAdminRes = await request(app)
        .get('/api/dashboards/college-admin/patrons')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studentToAdminRes.status).toBe(403);
      expect(studentToAdminRes.body.success).toBe(false);

      // Student attempting to access Super Admin endpoint
      const studentToSuperRes = await request(app)
        .get('/api/dashboards/admin-portal/overview')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studentToSuperRes.status).toBe(403);
      expect(studentToSuperRes.body.success).toBe(false);

      // College Admin attempting to access Super Admin endpoint
      const adminToSuperRes = await request(app)
        .get('/api/dashboards/admin-portal/overview')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(adminToSuperRes.status).toBe(403);
      expect(adminToSuperRes.body.success).toBe(false);
    });

    it('1.4 Authenticated requests with correct role succeed', async () => {
      const studentRes = await request(app)
        .get('/api/dashboards/student/overview')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(studentRes.status).toBe(200);
      expect(studentRes.body.success).toBe(true);
    });
  });

  describe('2. Password Hashing — Argon2id & Transparent Bcrypt Upgrade', () => {
    it('2.1 New passwords are automatically hashed using Argon2id', async () => {
      const user = await User.findById(studentUser._id).select('+password');
      expect(user.password.startsWith('$argon2')).toBe(true);
    });

    it('2.2 Legacy bcrypt passwords verify correctly and upgrade transparently to Argon2id on login', async () => {
      const legacyPassword = 'LegacyBcryptPass123!';
      const salt = await bcrypt.genSalt(10);
      const bcryptHash = await bcrypt.hash(legacyPassword, salt);

      const legacyUser = await User.create({
        studentId: `LEG_${Date.now()}`,
        name: 'Legacy User',
        email: `legacy_${Date.now()}@test.com`,
        password: bcryptHash,
        role: 'student',
        collegeId: college._id,
      });

      // Verify initial hash format is bcrypt
      const fetchedLegacy = await User.findById(legacyUser._id).select('+password');
      expect(fetchedLegacy.password.startsWith('$2')).toBe(true);

      // Perform login which triggers transparent upgrade
      const loginRes = await request(app).post('/api/auth/login').send({
        email: legacyUser.email,
        password: legacyPassword,
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);

      // Confirm stored password is now upgraded to Argon2id
      const upgradedUser = await User.findById(legacyUser._id).select('+password');
      expect(upgradedUser.password.startsWith('$argon2')).toBe(true);

      // Verify upgraded user can log in with new Argon2id hash
      const nextLoginRes = await request(app).post('/api/auth/login').send({
        email: legacyUser.email,
        password: legacyPassword,
      });
      expect(nextLoginRes.status).toBe(200);
    });
  });

  describe('3. Login Brute-Force Rate Limiting & Lockout', () => {
    it('3.1 Locks out IP/account after repeated failed login attempts with HTTP 429 and Retry-After header', async () => {
      const targetEmail = `bruteforce_${Date.now()}@test.com`;
      await User.create({
        studentId: `BF_${Date.now()}`,
        name: 'Brute Force User',
        email: targetEmail,
        password: 'CorrectPassword123!',
        role: 'student',
        collegeId: college._id,
      });

      // Trigger 5 consecutive failed login attempts
      for (let i = 0; i < 5; i++) {
        const failRes = await request(app).post('/api/auth/login').send({
          email: targetEmail,
          password: 'WrongPassword!',
        });
        expect([401, 429]).toContain(failRes.status);
      }

      // 6th attempt should be blocked with 429
      const blockedRes = await request(app).post('/api/auth/login').send({
        email: targetEmail,
        password: 'WrongPassword!',
      });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers['retry-after']).toBeDefined();
      expect(blockedRes.body.message).toMatch(/Too many (failed login attempts|requests)/i);
    });
  });

  describe('4. TOTP Multi-Factor Authentication (MFA)', () => {
    it('4.1 Allows user to setup MFA and generate secret + QR code URL', async () => {
      const setupRes = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(setupRes.status).toBe(200);
      expect(setupRes.body.success).toBe(true);
      expect(setupRes.body.secret).toBeDefined();
      expect(setupRes.body.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('4.2 Verifies TOTP code to enable MFA on user account', async () => {
      // Step 1: Setup MFA
      const setupRes = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      const { secret } = setupRes.body;

      // Step 2: Generate valid TOTP token
      const validCode = speakeasy.totp({ secret, encoding: 'base32' });

      // Step 3: Verify TOTP code
      const verifyRes = await request(app)
        .post('/api/auth/mfa/verify')
        .set('Authorization', `Bearer ${collegeAdminToken}`)
        .send({ totpCode: validCode });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      const updatedUser = await User.findById(collegeAdminUser._id);
      expect(updatedUser.isMfaEnabled).toBe(true);
    });

    it('4.3 Enforces MFA verification during login when MFA is enabled', async () => {
      const { resetFailedLogins } = require('../middlewares/loginRateLimiter');
      await resetFailedLogins({ ip: '::ffff:127.0.0.1', body: { email: collegeAdminUser.email } });

      // Setup and enable MFA
      const secret = speakeasy.generateSecret().base32;
      const adminToUpdate = await User.findById(collegeAdminUser._id).select('+password');
      adminToUpdate.mfaSecret = secret;
      adminToUpdate.isMfaEnabled = true;
      await adminToUpdate.save();

      // Login without TOTP code -> prompt for MFA
      const mfaRequiredRes = await request(app).post('/api/auth/login').send({
        email: collegeAdminUser.email,
        password: 'AdminPassword123!',
      });

      expect(mfaRequiredRes.status).toBe(401);
      expect(mfaRequiredRes.body.mfaRequired).toBe(true);

      // Generate fresh TOTP code immediately before request
      const validCode = speakeasy.totp({ secret, encoding: 'base32' });

      // Login with valid TOTP code -> succeeds
      const successLoginRes = await request(app).post('/api/auth/login').send({
        email: collegeAdminUser.email,
        password: 'AdminPassword123!',
        totpCode: validCode,
      });

      if (successLoginRes.status !== 200) {
        // eslint-disable-next-line no-console
        console.log('Test 4.3 Failure Body:', successLoginRes.status, successLoginRes.body);
      }

      expect(successLoginRes.status).toBe(200);
      expect(successLoginRes.body.success).toBe(true);
      expect(successLoginRes.body.accessToken).toBeDefined();
    });
  });
});
