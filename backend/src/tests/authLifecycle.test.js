/**
 * Consolidated Suite: auth Lifecycle
 * Merged from:
 *  - auth.test.js
 *  - googleAuth.test.js
 *  - phase3FullAuthFlow.test.js
 *  - persistentSessions.test.js
 *  - registration.test.js
 *  - registrationPersistence.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('auth Lifecycle Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: auth.test.js]', () => {
    // Integration tests verifying authentication security and multi-tenancy scoping.
    const request = require('supertest');
    const mongoose = require('mongoose');

    // Point environment variables to test database before requiring app
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';
    process.env.JWT_SECRET = 'testjwtsecretkey999';
    process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretkey999';
    process.env.JWT_ACCESS_EXPIRY = '5s';
    process.env.JWT_REFRESH_EXPIRY = '10s';
    // raised from default 30s: multi-step integration test, verified slow under coverage instrumentation only, see 2026-07-15 audit
    jest.setTimeout(90000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const RefreshToken = require('../models/RefreshToken');

    const getCookieFromRes = (res, cookieName) => {
      const cookies = res.headers['set-cookie'];
      if (!cookies) return undefined;
      const cookie = cookies.find((c) => c.startsWith(`${cookieName}=`));
      if (!cookie) return undefined;
      return cookie.split(';')[0].split('=')[1];
    };

    describe('Auth & Multi-Tenancy Backbone API Integration Tests', () => {
      let collegeA;
      let collegeB;
      let studentAData;
      let studentBData;

      beforeAll(async () => {
        // Connect to test database if not connected
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        // Clean database before starting
        await College.deleteMany({ code: { $in: ['TCA', 'TCB'] } });
        await User.deleteMany({
          email: {
            $in: [
              'student.a@test.com',
              'student.b@test.com',
              'public.student@test.com',
              'admin.injection@test.com',
            ],
          },
        });

        // Seed Colleges
        collegeA = await College.create({ name: 'Test College A', code: 'TCA' });
        collegeB = await College.create({ name: 'Test College B', code: 'TCB' });

        studentAData = {
          studentId: 'STU_A_001',
          name: 'Student A',
          email: 'student.a@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id.toString(),
        };

        studentBData = {
          studentId: 'STU_B_002',
          name: 'Student B',
          email: 'student.b@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id.toString(),
        };
      });

      afterAll(async () => {
        await mongoose.connection.db.dropDatabase();
        // await // mongoose.connection.close();
      });

      // Assertion 1: Register student returns tokens, hides password
      it('1. should register a student successfully, return tokens, and omit password', async () => {
        const res = await request(app).post('/api/v1/auth/register').send(studentAData);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.accessToken).toBeDefined();
        const cookieToken = getCookieFromRes(res, 'refreshToken');
        expect(cookieToken).toBeDefined();
        expect(res.body.user.password).toBeUndefined();
        expect(res.body.user.refreshTokenHash).toBeUndefined();
      });

      it('1b. should reject public registration without explicit collegeId (requiring tenant selection)', async () => {
        const res = await request(app).post('/api/v1/auth/register').send({
          studentId: 'STU_NO_COLLEGE',
          name: 'Public Signup User',
          email: 'nocollege@bookbuddy.com',
          password: 'password123',
          role: 'general',
        });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/College selection is required/i);
      });

      // Assertion 2: Login with correct credentials returns tokens
      it('2. should login successfully with correct credentials', async () => {
        const res = await request(app).post('/api/v1/auth/login').send({
          email: studentAData.email,
          password: studentAData.password,
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.accessToken).toBeDefined();
        const cookieToken = getCookieFromRes(res, 'refreshToken');
        expect(cookieToken).toBeDefined();
      });

      // Assertion 3: Login with wrong password returns 401
      it('3. should reject login with wrong password', async () => {
        const res = await request(app).post('/api/v1/auth/login').send({
          email: studentAData.email,
          password: 'wrongpassword',
        });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });

      // Assertion 4: Access protected route without token returns 401
      it('4. should reject access to debug tenant check route without token', async () => {
        const res = await request(app).get('/api/_debug/tenant-check');
        expect(res.status).toBe(401);
      });

      // Assertion 5: Access protected route with tampered token returns 401
      it('5. should reject access with tampered token', async () => {
        const res = await request(app)
          .get('/api/_debug/tenant-check')
          .set('Authorization', 'Bearer invalidtokenhere');

        expect(res.status).toBe(401);
      });

      // Assertion 6: Access college_admin-only route as student returns 403
      it('6. should reject access to admin portal dashboard as student (403)', async () => {
        const loginRes = await request(app).post('/api/v1/auth/login').send({
          email: studentAData.email,
          password: studentAData.password,
        });

        const res = await request(app)
          .get('/api/v1/dashboards/admin-portal/analytics')
          .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

        expect(res.status).toBe(403);
      });

      // Assertion 7: Two users in different colleges isolate tenant filter
      it("7. should verify student A's tenantFilter does NOT match student B's collegeId", async () => {
        // Register Student B
        await request(app).post('/api/v1/auth/register').send(studentBData);

        // Login Student A
        const loginARes = await request(app).post('/api/v1/auth/login').send({
          email: studentAData.email,
          password: studentAData.password,
        });

        // Login Student B
        const loginBRes = await request(app).post('/api/v1/auth/login').send({
          email: studentBData.email,
          password: studentBData.password,
        });

        // Get Tenant Scope for Student A
        const scopeARes = await request(app)
          .get('/api/_debug/tenant-check')
          .set('Authorization', `Bearer ${loginARes.body.accessToken}`);

        // Get Tenant Scope for Student B
        const scopeBRes = await request(app)
          .get('/api/_debug/tenant-check')
          .set('Authorization', `Bearer ${loginBRes.body.accessToken}`);

        expect(scopeARes.status).toBe(200);
        expect(scopeBRes.status).toBe(200);

        // Cross-Tenant Assertion: Make sure collegeId filters are isolated
        expect(scopeARes.body.tenantFilter.collegeId).toBe(collegeA._id.toString());
        expect(scopeBRes.body.tenantFilter.collegeId).toBe(collegeB._id.toString());
        expect(scopeARes.body.tenantFilter.collegeId).not.toBe(
          scopeBRes.body.tenantFilter.collegeId
        );
      });

      // Assertion 8: Refresh token rotation - old refresh token rejected
      it('8. should perform refresh token rotation and reject reused old refresh token', async () => {
        const loginRes = await request(app).post('/api/v1/auth/login').send({
          email: studentAData.email,
          password: studentAData.password,
        });

        const oldRefreshToken = getCookieFromRes(loginRes, 'refreshToken');

        // First rotation request
        const refreshRes1 = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', [`refreshToken=${oldRefreshToken}`]);

        expect(refreshRes1.status).toBe(200);
        expect(refreshRes1.body.accessToken).toBeDefined();

        // Replay attack: try using oldRefreshToken again outside grace period (must be rejected)
        const { hashToken } = require('../utils/token');
        const oldHash = hashToken(oldRefreshToken);
        await RefreshToken.updateOne(
          { tokenHash: oldHash },
          { revokedAt: new Date(Date.now() - 31000) }
        );
        const cacheHelper = require('../utils/cacheHelper');
        await cacheHelper.del(`session:${oldHash}`);

        const refreshRes2 = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', [`refreshToken=${oldRefreshToken}`]);

        expect(refreshRes2.status).toBe(401);
      });

      // Assertion 9: Logout invalidates refresh token
      it('9. should invalidate refresh token on logout', async () => {
        const loginRes = await request(app).post('/api/v1/auth/login').send({
          email: studentAData.email,
          password: studentAData.password,
        });

        const refreshToken = getCookieFromRes(loginRes, 'refreshToken');
        const accessToken = loginRes.body.accessToken;

        // Logout
        const logoutRes = await request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .set('Cookie', [`refreshToken=${refreshToken}`]);

        expect(logoutRes.status).toBe(200);

        // Attempting to refresh with invalidated token should fail
        const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

        expect(refreshRes.status).toBe(401);
      });

      // Assertion 10: Reject administrative role injection on registration
      it('10. should ignore/reject role injection of college-admin on registration', async () => {
        const maliciousData = {
          studentId: 'STU_MAL_003',
          name: 'Malicious Admin',
          email: 'malicious.admin@test.com',
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeA._id.toString(),
        };

        const res = await request(app).post('/api/v1/auth/register').send(maliciousData);

        // Zod validation or controller should reject it with 400 or 403
        expect([400, 403]).toContain(res.status);

        // Also verify no such user was registered
        const user = await User.findOne({ email: 'malicious.admin@test.com' });
        expect(user).toBeNull();
      });
    });
  });

  describe('[Source: googleAuth.test.js]', () => {
    const request = require('supertest');
    const app = require('../app');
    const mongoose = require('mongoose');
    const User = require('../models/User');

    describe('Google OAuth 2.0 Single Sign-On Integration Tests', () => {
      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
          try {
            await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
          } catch {
            try {
              await mongoose.connect('mongodb://127.0.0.1:27017/bookbuddy_test', {
                serverSelectionTimeoutMS: 3000,
              });
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn('MongoDB connection notice in test:', err.message);
            }
          }
        }
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await User.deleteMany({ email: /test_google_/ });
          // await // mongoose.connection.close();
        }
      });
      it('should reject Google auth request when idToken is missing', async () => {
        const res = await request(app).post('/api/v1/auth/google').send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Google ID Token is required');
      });

      it('should authenticate user or provision new student account via Google SSO token', async () => {
        const mockEmail = `test_google_${Date.now()}@example.com`;
        const dummyIdToken = `header.${Buffer.from(
          JSON.stringify({
            sub: `google_id_${Date.now()}`,
            email: mockEmail,
            name: 'Test Google Student',
            picture: 'https://lh3.googleusercontent.com/a/dummy',
          })
        ).toString('base64')}.signature`;

        const res = await request(app).post('/api/v1/auth/google').send({ idToken: dummyIdToken });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(mockEmail);

        // Verify record in MongoDB
        const createdUser = await User.findOne({ email: mockEmail });
        expect(createdUser).not.toBeNull();
        expect(createdUser.authProvider).toBe('google');
        expect(createdUser.isEmailVerified).toBe(true);
      });
    });
  });

  describe('[Source: phase3FullAuthFlow.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const StudentUploadBatch = require('../models/StudentUploadBatch');
    const { generateAccessToken } = require('../utils/token');

    describe('Phase 3 — Production Hardening: Full Upload-to-Login-to-Password-Change Lifecycle', () => {
      let collegeA;
      let collegeB;
      let adminA;
      let adminTokenA;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI, {
            tlsAllowInvalidCertificates: true,
          });
        }

        try {
          await User.collection.dropIndexes();
          await User.syncIndexes();
        } catch {
          // ignore
        }

        await User.deleteMany({});
        await College.deleteMany({});
        await StudentUploadBatch.deleteMany({});

        // 1. College A (MIT)
        collegeA = await College.create({
          name: 'Massachusetts Institute of Technology',
          code: 'MIT',
          domain: 'mit.edu',
          slug: 'mit-tech',
          status: 'active',
          isActive: true,
          subscriptionPlan: 'institution-enterprise',
        });

        // 2. College B (Stanford)
        collegeB = await College.create({
          name: 'Stanford University',
          code: 'STAN',
          domain: 'stanford.edu',
          slug: 'stanford-univ',
          status: 'active',
          isActive: true,
          subscriptionPlan: 'institution-enterprise',
        });

        // 3. College Admin for College A
        adminA = await User.create({
          name: 'Admin MIT',
          studentId: 'MIT-ADMIN-01',
          email: 'admin@mit.edu',
          password: 'AdminPassword123!',
          role: 'college-admin',
          collegeId: collegeA._id,
          status: 'active',
          isActive: true,
          permissions: ['canManagePatrons', 'canViewAnalytics'],
        });

        adminTokenA = generateAccessToken(adminA);
      });

      afterAll(async () => {
        await User.deleteMany({});
        await College.deleteMany({});
        await StudentUploadBatch.deleteMany({});
        // await // mongoose.connection.close();
      });

      const emailStudentId = 'MIT-P3-101';
      const emailStudentAddr = 'p3student@mit.edu';
      const offlineStudentId = 'MIT-P3-102';
      let generatedTempPassword = null;
      let firstLoginAccessToken = null;
      const newPermanentPassword = 'PermanentSecurePass@2026!';

      test('1. Step 1: Bulk upload ingestion with per-row credential delivery and offline slips', async () => {
        // Generate valid CSV with 1 student having email and 1 missing email
        const csvContent =
          'studentId,name,email,program,year\n' +
          `${emailStudentId},Phase3 Student,${emailStudentAddr},Computer Science,2\n` +
          `${offlineStudentId},Offline Handout Student,,Electrical Engineering,1\n`;

        // 1a. Dry-run validate
        const valRes = await request(app)
          .post('/api/admin/students/upload/validate')
          .set('Authorization', `Bearer ${adminTokenA}`)
          .attach('file', Buffer.from(csvContent, 'utf-8'), 'roster.csv');

        expect(valRes.status).toBe(200);
        expect(valRes.body.success).toBe(true);
        expect(valRes.body.batchId).toBeDefined();

        const batchId = valRes.body.batchId;
        const validRows = valRes.body.validRowsPayload;

        // 1b. Non-blocking commit
        const commitRes = await request(app)
          .post('/api/admin/students/upload/commit')
          .set('Authorization', `Bearer ${adminTokenA}`)
          .send({
            batchId,
            validRows,
            bulkDeactivateAbsent: false,
          });

        expect(commitRes.status).toBe(202);
        expect(commitRes.body.success).toBe(true);

        // Poll for background batch completion
        let batch;
        for (let i = 0; i < 40; i++) {
          batch = await StudentUploadBatch.findById(batchId);
          if (batch && batch.status === 'committed') break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(batch).toBeDefined();
        expect(batch.status).toBe('committed');
        expect(batch.createdCount).toBe(2);

        // Verify row delivery results (case-insensitive matching)
        const emailResult = batch.rowResults.find(
          (r) => r.studentId.toLowerCase() === emailStudentId.toLowerCase()
        );
        expect(emailResult).toBeDefined();
        expect(emailResult.deliveryStatus).toBe('sent');

        const offlineResult = batch.rowResults.find(
          (r) => r.studentId.toLowerCase() === offlineStudentId.toLowerCase()
        );
        expect(offlineResult).toBeDefined();
        expect(offlineResult.deliveryStatus).toBe('no_contact_info');

        // Verify offline credential slips collection
        expect(batch.credentialSlips.length).toBeGreaterThanOrEqual(1);
        const slip = batch.credentialSlips.find(
          (s) => s.studentId.toLowerCase() === offlineStudentId.toLowerCase()
        );
        expect(slip).toBeDefined();
        expect(slip.tempPassword).toBeDefined();
        expect(slip.deliveryChannel).toBe('printed_handout');

        // Extract the real random temporary password generated by production code!
        generatedTempPassword = slip.tempPassword;

        // Verify student document in DB has mustChangePasswordOnNextLogin: true
        const studentUser = await User.findOne({
          collegeId: collegeA._id,
          studentId: offlineStudentId.toLowerCase(),
        });

        expect(studentUser).toBeDefined();
        expect(studentUser.mustChangePasswordOnNextLogin).toBe(true);
        expect(studentUser.status).toBe('invited');
      });

      test('2. Step 2: First student login on tenant subdomain with real temporary credentials', async () => {
        expect(generatedTempPassword).toBeDefined();

        const res = await request(app)
          .post('/api/auth/login')
          .set('Host', 'mit-tech.bookbuddy.com')
          .send({
            studentId: offlineStudentId,
            password: generatedTempPassword,
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.mustChangePasswordOnNextLogin).toBe(true);
        expect(res.body.accessToken).toBeDefined();

        firstLoginAccessToken = res.body.accessToken;
      });

      test('3. Step 3: Forced password change via POST /api/v1/auth/change-password', async () => {
        // Attempting with wrong current password fails
        const badRes = await request(app)
          .post('/api/v1/auth/change-password')
          .set('Host', 'mit-tech.bookbuddy.com')
          .set('Authorization', `Bearer ${firstLoginAccessToken}`)
          .send({
            currentPassword: 'WrongPassword123!',
            newPassword: newPermanentPassword,
          });

        expect(badRes.status).toBe(400);
        expect(badRes.body.message).toContain('Current password does not match');

        // Successful change
        const changeRes = await request(app)
          .post('/api/v1/auth/change-password')
          .set('Host', 'mit-tech.bookbuddy.com')
          .set('Authorization', `Bearer ${firstLoginAccessToken}`)
          .send({
            currentPassword: generatedTempPassword,
            newPassword: newPermanentPassword,
          });

        expect(changeRes.status).toBe(200);
        expect(changeRes.body.success).toBe(true);
        expect(changeRes.body.message).toContain('Password changed successfully');

        // Verify DB update: status active & mustChangePasswordOnNextLogin false
        const updatedUser = await User.findOne({
          collegeId: collegeA._id,
          studentId: offlineStudentId.toLowerCase(),
        });
        expect(updatedUser.mustChangePasswordOnNextLogin).toBe(false);
        expect(updatedUser.status).toBe('active');
      });

      test('4. Step 4: Revocation of old temporary password and successful login with permanent password', async () => {
        // Old temporary password must now be rejected
        const oldLoginRes = await request(app)
          .post('/api/auth/login')
          .set('Host', 'mit-tech.bookbuddy.com')
          .send({
            studentId: offlineStudentId,
            password: generatedTempPassword,
          });

        expect(oldLoginRes.status).toBe(401);
        expect(oldLoginRes.body.message).toContain('Invalid credentials');

        // Permanent password succeeds
        const newLoginRes = await request(app)
          .post('/api/auth/login')
          .set('Host', 'mit-tech.bookbuddy.com')
          .send({
            studentId: offlineStudentId,
            password: newPermanentPassword,
          });

        expect(newLoginRes.status).toBe(200);
        expect(newLoginRes.body.success).toBe(true);
        expect(newLoginRes.body.user.mustChangePasswordOnNextLogin).toBe(false);
        expect(newLoginRes.body.accessToken).toBeDefined();

        // Store updated token
        firstLoginAccessToken = newLoginRes.body.accessToken;
      });

      test('5. Step 5: Tenant-scoped session verification and zero cross-tenant leakage defense', async () => {
        // Subdomain MIT session succeeds
        const profileRes = await request(app)
          .get('/api/v1/auth/profile')
          .set('Host', 'mit-tech.bookbuddy.com')
          .set('Authorization', `Bearer ${firstLoginAccessToken}`);

        expect(profileRes.status).toBe(200);
        expect(profileRes.body.success).toBe(true);
        expect(profileRes.body.data.studentId).toBe(offlineStudentId.toLowerCase());
        const returnedCollegeId =
          profileRes.body.data.collegeId?._id || profileRes.body.data.collegeId;
        expect(returnedCollegeId.toString()).toBe(collegeA._id.toString());

        // Zero Cross-Tenant Leakage 1: Student token from College A accessing College B subdomain
        const leakSubdomainRes = await request(app)
          .get('/api/v1/auth/profile')
          .set('Host', 'stanford-univ.bookbuddy.com')
          .set('Authorization', `Bearer ${firstLoginAccessToken}`);

        expect(leakSubdomainRes.status).toBe(403);
        expect(leakSubdomainRes.body.message).toContain('Cross-tenant access violation');

        // Zero Cross-Tenant Leakage 2: Student from College A trying to log in on College B subdomain
        const crossLoginRes = await request(app)
          .post('/api/auth/login')
          .set('Host', 'stanford-univ.bookbuddy.com')
          .send({
            studentId: offlineStudentId,
            password: newPermanentPassword,
          });

        expect(crossLoginRes.status).toBe(401);
        expect(crossLoginRes.body.message).toContain('Invalid credentials');
      });
    });
  });

  describe('[Source: persistentSessions.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_session_test';
    process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

    jest.setTimeout(30000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');

    describe('Persistent Sessions & Token Rotation Integration Tests', () => {
      let collegeId;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        collegeId = new mongoose.Types.ObjectId().toString();

        await College.create({
          _id: collegeId,
          name: 'Session Test College',
          code: 'SESS_COL',
          status: 'active',
        });

        await User.create({
          studentId: 'STU_SESS_99',
          name: 'Session Tester',
          email: 'session@test.edu',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeId,
          isActive: true,
        });
      });

      afterAll(async () => {
        await User.deleteMany({ email: 'session@test.edu' });
        await College.deleteMany({ _id: collegeId });
        // await // mongoose.connection.close();
      });

      it('1. Login sets 30-day httpOnly refresh cookie and returns access token', async () => {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'session@test.edu', password: 'Password123!' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('accessToken');
        expect(res.headers['set-cookie']).toBeDefined();

        const cookieHeader = res.headers['set-cookie'].join(';');
        expect(cookieHeader).toContain('refreshToken=');
        expect(cookieHeader).toContain('HttpOnly');
      });

      it('2. Token Rotation: Refreshing issues new access token and new rotated refresh cookie', async () => {
        // Step 1: Login to get initial cookie
        const loginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'session@test.edu', password: 'Password123!' });

        const initialCookie = loginRes.headers['set-cookie'];

        // Step 2: Refresh token
        const refreshRes = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', initialCookie);

        expect(refreshRes.status).toBe(200);
        expect(refreshRes.body.success).toBe(true);
        expect(refreshRes.body).toHaveProperty('accessToken');
        expect(refreshRes.headers['set-cookie']).toBeDefined();
      });

      it('3. Grace Period & Theft Reuse Detection: Parallel refresh within 30s grace period succeeds', async () => {
        // Step 1: Login
        const loginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'session@test.edu', password: 'Password123!' });

        const originalCookie = loginRes.headers['set-cookie'];

        // Step 2: Rotate token once (valid update)
        const firstRefreshRes = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', originalCookie);

        expect(firstRefreshRes.status).toBe(200);

        // Step 3: Immediate parallel retry with original cookie falls within 30s grace period -> 200 OK!
        const graceRes = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', originalCookie);

        expect(graceRes.status).toBe(200);
        expect(graceRes.body.success).toBe(true);
        expect(graceRes.body).toHaveProperty('accessToken');
      });

      it('4. Logout revokes session and clears cookie', async () => {
        const loginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'session@test.edu', password: 'Password123!' });

        const cookie = loginRes.headers['set-cookie'];

        const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);

        expect(logoutRes.status).toBe(200);
        expect(logoutRes.body.success).toBe(true);
      });
    });
  });

  describe('[Source: registration.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
    process.env.JWT_SECRET = 'testjwtsecretkey999';
    process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretkey999';

    jest.setTimeout(60000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const RegistrationRequest = require('../models/RegistrationRequest');
    const { generateTokenPair } = require('../utils/token');

    describe('Dual Registration System Integration Tests', () => {
      let activeCollege;
      let inactiveCollege;
      let superAdminUser;
      let superAdminToken;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
      });

      beforeEach(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await RegistrationRequest.deleteMany({});

        // Seed Active College with domain requirement
        activeCollege = await College.create({
          name: 'MIT University',
          code: 'MIT',
          domain: 'mit.edu',
          status: 'active',
          isActive: true,
          configuredDepartments: ['Computer Science', 'Electrical Engineering'],
        });

        // Seed Pending / Inactive College
        inactiveCollege = await College.create({
          name: 'Pending College',
          code: 'PEN',
          domain: 'pending.edu',
          status: 'pending',
          isActive: false,
        });

        // Seed Super Admin
        superAdminUser = await User.create({
          studentId: 'SA-001',
          name: 'Global Admin',
          email: 'superadmin@bookbuddy.app',
          password: 'SuperAdminPassword123!',
          role: 'super-admin',
          isEmailVerified: true,
        });

        superAdminToken = generateTokenPair(superAdminUser).accessToken;
      });

      afterAll(async () => {
        // await // mongoose.connection.close();
      });

      describe('GET /api/registration/colleges', () => {
        it('should return list of ACTIVE colleges only', async () => {
          const res = await request(app).get('/api/v1/registration/colleges');
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          const names = res.body.data.map((c) => c.name);
          expect(names).toContain('MIT University');
          expect(names).not.toContain('Pending College');
        });
      });

      describe('Flow A: Student Registration', () => {
        it('should reject registration if college is not active', async () => {
          const res = await request(app).post('/api/v1/registration/student').send({
            name: 'Test Student',
            email: 'student@pending.edu',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            collegeId: inactiveCollege._id.toString(),
            studentId: 'CS101',
            termsAccepted: true,
          });

          expect(res.status).toBe(400);
          expect(res.body.message).toContain('Target college is not active');
        });

        it('should reject registration if email domain does not match college domain', async () => {
          const res = await request(app).post('/api/v1/registration/student').send({
            name: 'Test Student',
            email: 'student@gmail.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            collegeId: activeCollege._id.toString(),
            studentId: 'CS101',
            termsAccepted: true,
          });

          expect(res.status).toBe(400);
          expect(res.body.message).toContain('must belong to your institution domain');
        });

        it('should successfully submit student registration and verify via OTP', async () => {
          // 1. Submit registration
          const regRes = await request(app).post('/api/v1/registration/student').send({
            name: 'John Harvard',
            email: 'jharvard@mit.edu',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            collegeId: activeCollege._id.toString(),
            studentId: 'STU999',
            department: 'Computer Science',
            termsAccepted: true,
          });

          expect(regRes.status).toBe(201);
          expect(regRes.body.success).toBe(true);

          // Check RegistrationRequest doc
          const reqDoc = await RegistrationRequest.findOne({
            'studentData.email': 'jharvard@mit.edu',
          });
          expect(reqDoc).not.toBeNull();
          expect(reqDoc.status).toBe('unverified');
          const otp = reqDoc.studentData.verificationOTP;

          // 2. Verify Email OTP
          const verifyRes = await request(app).post('/api/v1/registration/verify-email').send({
            email: 'jharvard@mit.edu',
            otp,
          });

          expect(verifyRes.status).toBe(200);
          expect(verifyRes.body.success).toBe(true);

          // Verify User record was provisioned
          const createdUser = await User.findOne({ email: 'jharvard@mit.edu' });
          expect(createdUser).not.toBeNull();
          expect(createdUser.role).toBe('student');
          expect(createdUser.collegeId.toString()).toBe(activeCollege._id.toString());
          expect(createdUser.studentId).toBe('stu999');
        });
      });

      describe('Flow B: Tenant Onboarding & Super Admin Approval', () => {
        it('should submit tenant onboarding request in pending_review status', async () => {
          const res = await request(app).post('/api/v1/registration/tenant-onboarding').send({
            legalName: 'Stanford University',
            shortName: 'Stanford',
            institutionType: 'university',
            domain: 'stanford.edu',
            address: '450 Jane Stanford Way, Stanford, CA',
            contactPhone: '+16507232300',
            adminName: 'Dr. Jane Stanford',
            adminEmail: 'admin@stanford.edu',
            designation: 'Head Librarian',
            password: 'AdminPassword123!',
            confirmPassword: 'AdminPassword123!',
            desiredSlug: 'stanford-edu',
            termsAccepted: true,
          });

          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);

          const reqDoc = await RegistrationRequest.findOne({
            'tenantData.domain': 'stanford.edu',
          });
          expect(reqDoc).not.toBeNull();
          expect(reqDoc.status).toBe('pending_review');
        });

        it('should allow Super Admin to approve onboarding and atomically provision College + Admin User', async () => {
          // 1. Create pending onboarding request
          const reqDoc = await RegistrationRequest.create({
            type: 'tenant_onboarding',
            status: 'pending_review',
            tenantData: {
              legalName: 'Oxford University',
              shortName: 'Oxford',
              institutionType: 'university',
              domain: 'ox.ac.uk',
              address: 'Wellington Square, Oxford',
              contactPhone: '+441865270000',
              adminName: 'Prof. William',
              adminEmail: 'admin@ox.ac.uk',
              designation: 'Director',
              passwordHash: '$2b$12$eImiTXuWVxfM37uY4JANjO5E5k8V.916T.R8W9w1/u81S6Z9x5m.e', // pre-hashed
              desiredSlug: 'oxford-uni',
            },
          });

          // 2. Super Admin approves request
          const approveRes = await request(app)
            .post(`/api/v1/dashboards/admin-portal/onboardings/${reqDoc._id}/approve`)
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(approveRes.status).toBe(200);
          expect(approveRes.body.success).toBe(true);

          // Check College tenant created
          const createdCollege = await College.findOne({ slug: 'oxford-uni' });
          expect(createdCollege).not.toBeNull();
          expect(createdCollege.status).toBe('active');

          // Check College Admin User created
          const createdAdmin = await User.findOne({ email: 'admin@ox.ac.uk' });
          expect(createdAdmin).not.toBeNull();
          expect(createdAdmin.role).toBe('college-admin');
          expect(createdAdmin.collegeId.toString()).toBe(createdCollege._id.toString());
        });
      });
    });
  });

  describe('[Source: registrationPersistence.test.js]', () => {
    const request = require('supertest');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const RegistrationRequest = require('../models/RegistrationRequest');

    describe('Registration Persistence & Multi-Tenant Scoping Regression Tests', () => {
      let collegeA;
      let collegeB;

      beforeEach(async () => {
        await User.deleteMany({});
        await College.deleteMany({});
        await RegistrationRequest.deleteMany({});

        collegeA = await College.create({
          name: 'College Alpha',
          code: 'ALPHA_01',
          status: 'active',
          isActive: true,
          domain: 'alpha.edu',
        });

        collegeB = await College.create({
          name: 'College Beta',
          code: 'BETA_01',
          status: 'active',
          isActive: true,
          domain: 'beta.edu',
        });
      });

      it('definitively persists student registration details to MongoDB User collection after 2-step verification', async () => {
        const studentData = {
          name: 'Jane Doe',
          email: 'jane@alpha.edu',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          collegeId: collegeA._id.toString(),
          studentId: 'STU-1001',
          department: 'Computer Science',
          termsAccepted: true,
        };

        // Step 1: Submit self-registration
        const regRes = await request(app).post('/api/registration/student').send(studentData);

        expect(regRes.status).toBe(201);
        expect(regRes.body.success).toBe(true);
        expect(regRes.body.data.email).toBe('jane@alpha.edu');

        // Verify RegistrationRequest document exists in DB
        const regReqDoc = await RegistrationRequest.findOne({
          'studentData.email': 'jane@alpha.edu',
          status: 'unverified',
        });
        expect(regReqDoc).not.toBeNull();
        expect(regReqDoc.studentData.studentId).toBe('STU-1001');
        expect(regReqDoc.studentData.verificationOTP).toBeDefined();

        const devOtp = regRes.body.data.devOtp || regReqDoc.studentData.verificationOTP;

        // Step 2: Verify email via OTP
        const verifyRes = await request(app).post('/api/registration/verify-email').send({
          email: 'jane@alpha.edu',
          otp: devOtp,
        });

        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.success).toBe(true);

        // Step 3: Direct MongoDB Verification — Assert User document is saved in database
        const persistedUser = await User.findOne({ email: 'jane@alpha.edu' });
        expect(persistedUser).not.toBeNull();
        expect(persistedUser._id).toBeDefined();
        expect(persistedUser.name).toBe('Jane Doe');
        expect(persistedUser.studentId.toLowerCase()).toBe('stu-1001');
        expect(persistedUser.collegeId.toString()).toBe(collegeA._id.toString());
        expect(persistedUser.role).toBe('student');
        expect(persistedUser.isEmailVerified).toBe(true);
        expect(persistedUser.membershipStatus).toBe('active');
      });

      it('allows duplicate studentId across DIFFERENT colleges (Multi-Tenant Isolation)', async () => {
        // Create user in College A with studentId 'ENROLL-999'
        await User.create({
          studentId: 'ENROLL-999',
          name: 'Student A',
          email: 'studenta@alpha.edu',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeA._id,
          isEmailVerified: true,
        });

        // Register user in College B with the SAME studentId 'ENROLL-999'
        const studentBData = {
          studentId: 'ENROLL-999',
          name: 'Student B',
          email: 'studentb@beta.edu',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeB._id.toString(),
        };

        const registerRes = await request(app).post('/api/auth/register').send(studentBData);

        expect(registerRes.status).toBe(201);
        expect(registerRes.body.success).toBe(true);

        // Verify both users exist in MongoDB with identical studentId under distinct collegeIds
        const userInCollegeA = await User.findOne({
          collegeId: collegeA._id,
          studentId: 'ENROLL-999',
        });
        const userInCollegeB = await User.findOne({
          collegeId: collegeB._id,
          studentId: 'ENROLL-999',
        });

        expect(userInCollegeA).not.toBeNull();
        expect(userInCollegeB).not.toBeNull();
        expect(userInCollegeA._id.toString()).not.toBe(userInCollegeB._id.toString());
      });
    });
  });
});
