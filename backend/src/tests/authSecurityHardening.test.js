/**
 * Consolidated Suite: auth Security Hardening
 * Merged from:
 *  - authAuthorizationHardening.test.js
 *  - productionHardeningAuth.test.js
 *  - impersonationAudit.test.js
 *  - securityPhase0.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('auth Security Hardening Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: authAuthorizationHardening.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const bcrypt = require('bcrypt');
    const speakeasy = require('speakeasy');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_auth_test';

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
        // await // mongoose.disconnect();
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
          const studentRes = await request(app).get('/api/v1/dashboards/student/overview');
          expect(studentRes.status).toBe(401);
          expect(studentRes.body.success).toBe(false);

          const adminRes = await request(app).get('/api/v1/dashboards/college-admin/patrons');
          expect(adminRes.status).toBe(401);
          expect(adminRes.body.success).toBe(false);

          const superRes = await request(app).get('/api/v1/dashboards/admin-portal/overview');
          expect(superRes.status).toBe(401);
          expect(superRes.body.success).toBe(false);
        });

        it('1.2 Authenticated requests with invalid/fake tokens return HTTP 401', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/student/overview')
            .set('Authorization', 'Bearer invalid_fake_token_123');

          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        });

        it('1.3 Authenticated requests with wrong role return HTTP 403 on protected routes', async () => {
          // Student attempting to access College Admin endpoint
          const studentToAdminRes = await request(app)
            .get('/api/v1/dashboards/college-admin/patrons')
            .set('Authorization', `Bearer ${studentToken}`);

          expect(studentToAdminRes.status).toBe(403);
          expect(studentToAdminRes.body.success).toBe(false);

          // Student attempting to access Super Admin endpoint
          const studentToSuperRes = await request(app)
            .get('/api/v1/dashboards/admin-portal/overview')
            .set('Authorization', `Bearer ${studentToken}`);

          expect(studentToSuperRes.status).toBe(403);
          expect(studentToSuperRes.body.success).toBe(false);

          // College Admin attempting to access Super Admin endpoint
          const adminToSuperRes = await request(app)
            .get('/api/v1/dashboards/admin-portal/overview')
            .set('Authorization', `Bearer ${collegeAdminToken}`);

          expect(adminToSuperRes.status).toBe(403);
          expect(adminToSuperRes.body.success).toBe(false);
        });

        it('1.4 Authenticated requests with correct role succeed', async () => {
          const studentRes = await request(app)
            .get('/api/v1/dashboards/student/overview')
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
          const loginRes = await request(app).post('/api/v1/auth/login').send({
            email: legacyUser.email,
            password: legacyPassword,
          });

          expect(loginRes.status).toBe(200);
          expect(loginRes.body.success).toBe(true);

          // Confirm stored password is now upgraded to Argon2id
          const upgradedUser = await User.findById(legacyUser._id).select('+password');
          expect(upgradedUser.password.startsWith('$argon2')).toBe(true);

          // Verify upgraded user can log in with new Argon2id hash
          const nextLoginRes = await request(app).post('/api/v1/auth/login').send({
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
            const failRes = await request(app).post('/api/v1/auth/login').send({
              email: targetEmail,
              password: 'WrongPassword!',
            });
            expect([401, 429]).toContain(failRes.status);
          }

          // 6th attempt should be blocked with 429
          const blockedRes = await request(app).post('/api/v1/auth/login').send({
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
            .post('/api/v1/auth/mfa/setup')
            .set('Authorization', `Bearer ${collegeAdminToken}`);

          expect(setupRes.status).toBe(200);
          expect(setupRes.body.success).toBe(true);
          expect(setupRes.body.secret).toBeDefined();
          expect(setupRes.body.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
        });

        it('4.2 Verifies TOTP code to enable MFA on user account', async () => {
          // Step 1: Setup MFA
          const setupRes = await request(app)
            .post('/api/v1/auth/mfa/setup')
            .set('Authorization', `Bearer ${collegeAdminToken}`);

          const { secret } = setupRes.body;

          // Step 2: Generate valid TOTP token
          const validCode = speakeasy.totp({ secret, encoding: 'base32' });

          // Step 3: Verify TOTP code
          const verifyRes = await request(app)
            .post('/api/v1/auth/mfa/verify')
            .set('Authorization', `Bearer ${collegeAdminToken}`)
            .send({ totpCode: validCode });

          expect(verifyRes.status).toBe(200);
          expect(verifyRes.body.success).toBe(true);

          const updatedUser = await User.findById(collegeAdminUser._id);
          expect(updatedUser.isMfaEnabled).toBe(true);
        });

        it('4.3 Enforces MFA verification during login when MFA is enabled', async () => {
          const { resetFailedLogins } = require('../middlewares/loginRateLimiter');
          await resetFailedLogins({
            ip: '::ffff:127.0.0.1',
            body: { email: collegeAdminUser.email },
          });

          // Setup and enable MFA
          const secret = speakeasy.generateSecret().base32;
          const adminToUpdate = await User.findById(collegeAdminUser._id).select('+password');
          adminToUpdate.mfaSecret = secret;
          adminToUpdate.isMfaEnabled = true;
          await adminToUpdate.save();

          // Login without TOTP code -> prompt for MFA
          const mfaRequiredRes = await request(app).post('/api/v1/auth/login').send({
            email: collegeAdminUser.email,
            password: 'AdminPassword123!',
          });

          expect(mfaRequiredRes.status).toBe(401);
          expect(mfaRequiredRes.body.mfaRequired).toBe(true);

          // Generate fresh TOTP code immediately before request
          const validCode = speakeasy.totp({ secret, encoding: 'base32' });

          // Login with valid TOTP code -> succeeds
          const successLoginRes = await request(app).post('/api/v1/auth/login').send({
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
  });

  describe('[Source: productionHardeningAuth.test.js]', () => {
    const request = require('supertest');
    const fs = require('fs');
    const path = require('path');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshsecret';
    jest.setTimeout(60000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const RefreshToken = require('../models/RefreshToken');

    describe('ITEM 1 — Auth: httpOnly Cookies, Refresh Token Rotation, Theft Detection & CSRF', () => {
      let testCollege;
      let testUser;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
      });

      beforeEach(async () => {
        await User.deleteMany({});
        await College.deleteMany({});
        await RefreshToken.deleteMany({});

        testCollege = await College.create({
          name: 'Auth Testing Institute',
          code: 'AUTH101',
          maxFineLimit: 100,
        });

        testUser = await User.create({
          studentId: 'STU_AUTH_001',
          name: 'Auth Test Student',
          email: 'authtest@bookbuddy.com',
          password: 'Password@123',
          role: 'student',
          collegeId: testCollege._id,
        });
      });

      const getCookieFromRes = (res, cookieName) => {
        const cookies = res.headers['set-cookie'];
        if (!cookies) return null;
        const target = cookies.find((c) => c.startsWith(`${cookieName}=`));
        if (!target) return null;
        return target.split(';')[0].split('=')[1];
      };

      test('1.1 Login sets httpOnly refreshToken cookie and returns access token in body', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'authtest@bookbuddy.com', password: 'Password@123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeUndefined();

        const refreshCookie = getCookieFromRes(res, 'refreshToken');
        expect(refreshCookie).toBeDefined();
        expect(refreshCookie.length).toBeGreaterThan(20);

        const tokensInDb = await RefreshToken.find({ userId: testUser._id });
        expect(tokensInDb.length).toBe(1);
        expect(tokensInDb[0].revokedAt).toBeNull();
      });

      test('1.2 Refresh-token rotation succeeds on valid use (issues new token pair, revokes old)', async () => {
        const loginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'authtest@bookbuddy.com', password: 'Password@123' });

        const firstCookie = getCookieFromRes(loginRes, 'refreshToken');
        expect(firstCookie).toBeDefined();

        const refreshRes = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', [`refreshToken=${firstCookie}`]);

        expect(refreshRes.status).toBe(200);
        expect(refreshRes.body.success).toBe(true);
        expect(refreshRes.body.accessToken).toBeDefined();

        const secondCookie = getCookieFromRes(refreshRes, 'refreshToken');
        expect(secondCookie).toBeDefined();
        expect(secondCookie).not.toBe(firstCookie);

        const activeTokens = await RefreshToken.find({ userId: testUser._id, revokedAt: null });
        const revokedTokens = await RefreshToken.find({
          userId: testUser._id,
          revokedAt: { $ne: null },
        });

        expect(activeTokens.length).toBe(1);
        expect(revokedTokens.length).toBe(1);
        expect(revokedTokens[0].replacedBy).toBeDefined();
      });

      test('1.3 Reuse of an already-rotated (revoked) refresh token is rejected AND revokes all sessions for that user', async () => {
        const loginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'authtest@bookbuddy.com', password: 'Password@123' });
        const firstCookie = getCookieFromRes(loginRes, 'refreshToken');

        await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', [`refreshToken=${firstCookie}`]);

        const { hashToken } = require('../utils/token');
        const oldHash = hashToken(firstCookie);
        await RefreshToken.updateOne(
          { tokenHash: oldHash },
          { revokedAt: new Date(Date.now() - 31000) }
        );
        const cacheHelper = require('../utils/cacheHelper');
        await cacheHelper.del(`session:${oldHash}`);

        const reuseRes = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', [`refreshToken=${firstCookie}`]);

        expect(reuseRes.status).toBe(401);
        expect(reuseRes.body.message).toContain('Session reuse detected');

        const activeTokens = await RefreshToken.find({ userId: testUser._id, revokedAt: null });
        const allTokens = await RefreshToken.find({ userId: testUser._id });

        expect(activeTokens.length).toBe(0);
        expect(allTokens.length).toBeGreaterThan(0);
        allTokens.forEach((t) => {
          expect(t.revokedAt).not.toBeNull();
        });
      });

      test('1.4 A state-changing request without a valid CSRF token is rejected with 403', async () => {
        const csrfRes = await request(app).get('/api/v1/auth/csrf-token');
        expect(csrfRes.status).toBe(200);
        const csrfCookie = getCookieFromRes(csrfRes, '_csrf');
        const csrfToken = csrfRes.body.csrfToken;

        expect(csrfCookie).toBeDefined();
        expect(csrfToken).toBeDefined();

        const badRes = await request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', [`_csrf=${csrfCookie}`]);

        expect(badRes.status).toBe(403);
        expect(badRes.body.message).toContain('CSRF');

        const goodRes = await request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', [`_csrf=${csrfCookie}`])
          .set('x-csrf-token', csrfToken);

        expect(goodRes.status).toBe(200);
      });

      test('1.5 Client source code audit: No access or refresh token is written to localStorage', () => {
        const clientSrcDir = path.join(__dirname, '../../../client/src');
        if (!fs.existsSync(clientSrcDir)) {
          return;
        }

        const scanDir = (dir) => {
          const files = fs.readdirSync(dir);
          let forbiddenHits = [];

          for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              forbiddenHits = forbiddenHits.concat(scanDir(fullPath));
            } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
              const content = fs.readFileSync(fullPath, 'utf8');
              if (
                content.includes("localStorage.setItem('token'") ||
                content.includes("localStorage.setItem('accessToken'") ||
                content.includes("localStorage.setItem('refreshToken'") ||
                content.includes("localStorage.setItem('auth-storage'")
              ) {
                forbiddenHits.push(fullPath);
              }
            }
          }
          return forbiddenHits;
        };

        const hits = scanDir(clientSrcDir);
        expect(hits).toEqual([]);
      });
    });
  });

  describe('[Source: impersonationAudit.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecretkey999';

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const AuditLog = require('../models/AuditLog');
    const { generateAccessToken, verifyAccessToken } = require('../utils/token');

    describe('Super Admin Impersonation & Audit Log Anti-Falsification Test', () => {
      let superAdminUser;
      let superAdminToken;
      let targetUser;
      let testCollege;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
          });
        }

        await College.deleteMany({ code: 'IMPERUNIV' });
        await User.deleteMany({
          email: {
            $in: [
              'superadmin.imp@bookbuddy.internal',
              'targetuser.imp@imperuniv.edu',
              'tempsa@imperuniv.edu',
            ],
          },
        });

        testCollege = await College.create({
          name: 'Impersonation Test University',
          code: 'IMPERUNIV',
          slug: 'imper-univ',
          domain: 'imperuniv.edu',
          status: 'active',
        });

        superAdminUser = await User.create({
          studentId: 'SA-IMP-001',
          name: 'Original Super Admin',
          email: 'superadmin.imp@bookbuddy.internal',
          password: 'SuperAdminPass123!',
          role: 'super-admin',
          status: 'active',
        });
        superAdminToken = generateAccessToken(superAdminUser);

        targetUser = await User.create({
          studentId: 'STU-IMP-001',
          name: 'Impersonated Student',
          email: 'targetuser.imp@imperuniv.edu',
          password: 'StudentPass123!',
          role: 'student',
          collegeId: testCollege._id,
          status: 'active',
        });
      });

      afterAll(async () => {
        await College.deleteMany({ code: 'IMPERUNIV' });
        await User.deleteMany({
          email: {
            $in: [
              'superadmin.imp@bookbuddy.internal',
              'targetuser.imp@imperuniv.edu',
              'tempsa@imperuniv.edu',
            ],
          },
        });
      });

      it('should generate an impersonation token containing isImpersonated and originalSuperAdminId', async () => {
        const res = await request(app)
          .post(`/api/v1/dashboards/admin-portal/users/${targetUser._id}/impersonate`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({});

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();

        const decoded = verifyAccessToken(res.body.token);
        expect(decoded.sub).toBe(targetUser._id.toString());
        expect(decoded.isImpersonated).toBe(true);
        expect(decoded.originalSuperAdminId).toBe(superAdminUser._id.toString());
      });

      it('should attribute audit logs to originalSuperAdminId when action is taken using impersonated token', async () => {
        // Generate impersonated token for target user
        const impersonatedToken = generateAccessToken(targetUser, {
          isImpersonated: true,
          originalSuperAdminId: superAdminUser._id.toString(),
        });

        const decodedTargetToken = verifyAccessToken(impersonatedToken);
        expect(decodedTargetToken.sub).toBe(targetUser._id.toString());
        expect(decodedTargetToken.isImpersonated).toBe(true);
        expect(decodedTargetToken.originalSuperAdminId).toBe(superAdminUser._id.toString());

        // Make an audited request using the impersonated token on a route protected by auditLog middleware
        // We elevated targetUser role temporarily to pass RBAC for testing auditLog middleware attribution
        const superAdminRoleUser = await User.create({
          studentId: 'SA-TEMP-001',
          name: 'Temp Super Admin Role Target',
          email: 'tempsa@imperuniv.edu',
          password: 'TempPassword123!',
          role: 'super-admin',
          status: 'active',
        });

        const impersonatedSuperToken = generateAccessToken(superAdminRoleUser, {
          isImpersonated: true,
          originalSuperAdminId: superAdminUser._id.toString(),
        });

        const res = await request(app)
          .patch(`/api/v1/dashboards/admin-portal/users/${targetUser._id}/status`)
          .set('Authorization', `Bearer ${impersonatedSuperToken}`)
          .send({ status: 'active', membershipStatus: 'active' });

        expect(res.status).toBe(200);

        // Wait briefly for res.on('finish') auditLog write to complete
        await new Promise((r) => setTimeout(r, 200));

        // Query AuditLog created for this action
        const log = await AuditLog.findOne({
          action: 'user.status_update',
          targetId: targetUser._id,
        }).sort({ createdAt: -1 });

        expect(log).not.toBeNull();
        // Anti-falsification assertion: actorId MUST be the original super admin ID, not the impersonated target user ID!
        expect(log.actorId.toString()).toBe(superAdminUser._id.toString());
        expect(log.metadata.isImpersonated).toBe(true);
        expect(log.metadata.impersonatedUserId.toString()).toBe(superAdminRoleUser._id.toString());

        await User.findByIdAndDelete(superAdminRoleUser._id);
      });
    });
  });

  describe('[Source: securityPhase0.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_security_phase0_test';
    process.env.JWT_SECRET = 'testjwtsecretsecurityphase0key999';
    process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretsecurityphase0key999';

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Reservation = require('../models/Reservation');
    const { generateTokenPair } = require('../utils/token');

    describe('Phase 0 Emergency Security Patch Integration Tests', () => {
      let college;
      let userA;
      let userB;
      let tokenUserA;
      let tokenUserB;
      let outOfStockBook;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
      });

      afterAll(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Reservation.deleteMany({});
        // await // mongoose.disconnect();
      });

      beforeEach(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Reservation.deleteMany({});

        college = await College.create({
          name: 'Security Test College',
          code: 'STC',
          domain: 'security.edu',
          status: 'active',
          isActive: true,
        });

        userA = await User.create({
          studentId: 'STU_SEC_A',
          name: 'User A',
          email: 'usera@security.edu',
          password: 'password123',
          collegeId: college._id,
          role: 'student',
          isActive: true,
        });

        userB = await User.create({
          studentId: 'STU_SEC_B',
          name: 'User B',
          email: 'userb@security.edu',
          password: 'password123',
          collegeId: college._id,
          role: 'student',
          isActive: true,
        });

        tokenUserA = generateTokenPair(userA).accessToken;
        tokenUserB = generateTokenPair(userB).accessToken;

        outOfStockBook = await Book.create({
          collegeId: college._id,
          isbn: '9780000000001',
          title: 'Out of Stock Security Book',
          author: 'Security Author',
          category: 'Computer Science',
          copiesTotal: 1,
          copiesAvailable: 0,
        });
      });

      test('1. IDOR Prevention: User B cannot cancel User A reservation (returns 404 and leaves hold active)', async () => {
        // User A creates a reservation
        const createRes = await request(app)
          .post('/api/v1/reservations')
          .set('Authorization', `Bearer ${tokenUserA}`)
          .send({ bookId: outOfStockBook._id.toString() });

        expect(createRes.status).toBe(200);
        const reservationId = createRes.body.data._id || createRes.body.data.id;

        // User B attempts to DELETE User A's reservation
        const deleteRes = await request(app)
          .delete(`/api/v1/reservations/${reservationId}`)
          .set('Authorization', `Bearer ${tokenUserB}`);

        expect(deleteRes.status).toBe(404);
        expect(deleteRes.body.message).toMatch(/Reservation not found/i);

        // Verify reservation remains queued in DB
        const dbReservation = await Reservation.findById(reservationId);
        expect(dbReservation).not.toBeNull();
        expect(dbReservation.status).toBe('queued');
        expect(dbReservation.userId.toString()).toBe(userA._id.toString());
      });

      test('2. Strict CORS: Requests from unlisted origin are rejected', async () => {
        const corsRes = await request(app)
          .get('/api/v1/registration/colleges')
          .set('Origin', 'http://malicious-unlisted-site.com');

        // CORS rejection by express cors middleware suppresses Access-Control-Allow-Origin header
        expect(corsRes.headers['access-control-allow-origin']).toBeUndefined();
      });

      test('3. Strict CORS: Requests from allowed origin (localhost:5173) are accepted', async () => {
        const corsRes = await request(app)
          .get('/api/v1/registration/colleges')
          .set('Origin', 'http://localhost:5173');

        expect(corsRes.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      });
    });
  });
});
