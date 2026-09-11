/**
 * Consolidated Suite: roster Bulk Ingestion
 * Merged from:
 *  - rosterIndexVerification.test.js
 *  - rosterUploadAndActivation.security.test.js
 *  - serviceCatalogAndBulkUpload.test.js
 *  - smsCredentialDelivery.test.js
 *  - emailFallback.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('roster Bulk Ingestion Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: rosterIndexVerification.test.js]', () => {
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';

    jest.setTimeout(30000);

    const User = require('../models/User');

    function getPlanStages(plan) {
      let current = plan;
      const stages = [];
      while (current) {
        if (current.stage) stages.push(current.stage);
        current = current.inputStage || (current.inputStages && current.inputStages[0]);
      }
      return stages;
    }

    describe('F15 Index Verification — Scoped Login & Activation Queries', () => {
      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        // Ensure all schema indexes are synchronized in test DB
        await User.syncIndexes();
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          // await // mongoose.connection.close();
        }
      });

      it('confirms { collegeId: 1, studentId: 1 } uses IXSCAN (Index Scan) on student login query path', async () => {
        const mockCollegeId = new mongoose.Types.ObjectId();
        const explanation = await User.findOne({
          collegeId: mockCollegeId,
          studentId: 'STU-1001',
        }).explain('executionStats');

        const winningStage = explanation.queryPlanner.winningPlan;
        const stages = getPlanStages(winningStage);

        expect(stages).toContain('IXSCAN');
      });

      it('confirms { collegeId: 1, email: 1 } uses IXSCAN (Index Scan) on email login query path', async () => {
        const mockCollegeId = new mongoose.Types.ObjectId();
        const explanation = await User.findOne({
          collegeId: mockCollegeId,
          email: 'student@springfield.edu',
        }).explain('executionStats');

        const winningStage = explanation.queryPlanner.winningPlan;
        const stages = getPlanStages(winningStage);

        expect(stages).toContain('IXSCAN');
      });

      it('confirms { activationTokenHash: 1 } uses IXSCAN (Index Scan) on activation token verification path', async () => {
        const explanation = await User.findOne({
          activationTokenHash: 'dummy_sha256_hash_value',
        }).explain('executionStats');

        const winningStage = explanation.queryPlanner.winningPlan;
        const stages = getPlanStages(winningStage);

        expect(stages).toContain('IXSCAN');
      });

      it('confirms { collegeId: 1, status: 1 } uses IXSCAN (Index Scan) on admin roster view path', async () => {
        const mockCollegeId = new mongoose.Types.ObjectId();
        const explanation = await User.find({
          collegeId: mockCollegeId,
          status: 'active',
        }).explain('executionStats');

        const winningStage = explanation.queryPlanner.winningPlan;
        const stages = getPlanStages(winningStage);

        expect(stages).toContain('IXSCAN');
      });
    });
  });

  describe('[Source: rosterUploadAndActivation.security.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const crypto = require('crypto');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';

    jest.setTimeout(30000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const StudentUploadBatch = require('../models/StudentUploadBatch');
    const { generateAccessToken } = require('../utils/token');

    describe('F15 Security Test Suite — Bulk Roster Upload, Token Activation & Scoped Auth', () => {
      let collegeA;
      let collegeB;
      let adminUserA;
      let adminTokenA;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await User.deleteMany({});
        await College.deleteMany({});
        await StudentUploadBatch.deleteMany({});

        collegeA = await College.create({
          name: 'Springfield University',
          code: 'SPRINGFIELD',
          slug: 'springfield',
          status: 'active',
          isActive: true,
        });

        collegeB = await College.create({
          name: 'Shelbyville Institute',
          code: 'SHELBYVILLE',
          slug: 'shelbyville',
          status: 'active',
          isActive: true,
        });

        adminUserA = await User.create({
          studentId: 'ADM-001',
          name: 'Springfield Admin',
          email: 'admin@springfield.edu',
          password: 'Password123!',
          role: 'college-admin',
          collegeId: collegeA._id,
          status: 'active',
        });

        adminTokenA = generateAccessToken({
          id: adminUserA._id,
          sub: adminUserA._id,
          role: 'college-admin',
          collegeId: collegeA._id,
        });
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          // await // mongoose.connection.close();
        }
      });

      describe('1. Dry-Run Isolation Check', () => {
        it('confirms validate (step 1) writes ZERO user/student records to DB', async () => {
          const initialCount = await User.countDocuments({ role: 'student' });

          const csvContent =
            'StudentId,Name,Email,Program,Year\n' +
            'STU-DRY-101,Dry Run Student,dryrun@springfield.edu,Computer Science,Year 1\n';

          const res = await request(app)
            .post('/api/admin/students/upload/validate')
            .set('Authorization', `Bearer ${adminTokenA}`)
            .attach('file', Buffer.from(csvContent), 'dry_run_roster.csv');

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.summary.toCreateCount).toBe(1);

          // Verify ZERO student accounts created in database
          const finalCount = await User.countDocuments({ role: 'student' });
          expect(finalCount).toBe(initialCount);
        });
      });

      describe('2. Session-Derived collegeId Enforcer', () => {
        it('strictly enforces session-derived collegeId even if file contains spoofed college identifier', async () => {
          const validRowsPayload = [
            {
              studentId: 'STU-SPOOF-01',
              name: 'Spoof Test Student',
              email: 'spoof@springfield.edu',
              program: 'Robotics',
              year: 'Year 1',
              fileCollegeId: collegeB._id.toString(), // Attempted spoof of College B
            },
          ];

          // Validate dry-run
          const batch = await StudentUploadBatch.create({
            collegeId: collegeA._id,
            uploadedBy: adminUserA._id,
            fileName: 'spoof_test.csv',
            totalRows: 1,
            validRowsCount: 1,
            createdCount: 1,
            updatedCount: 0,
            status: 'preview',
          });

          const commitRes = await request(app)
            .post('/api/admin/students/upload/commit')
            .set('Authorization', `Bearer ${adminTokenA}`)
            .send({
              batchId: batch._id,
              validRows: validRowsPayload,
            });

          expect(commitRes.statusCode).toBe(200);
          expect(commitRes.body.summary.createdCount).toBe(1);

          const createdStudent = await User.findOne({ studentId: 'STU-SPOOF-01' });
          expect(createdStudent).toBeDefined();
          // MUST belong to Admin's session collegeA, NEVER spoofed collegeB!
          expect(createdStudent.collegeId.toString()).toBe(collegeA._id.toString());
        });
      });

      describe('3. Cross-College studentId Collision', () => {
        it('creates same studentId at College A and College B independently without collision', async () => {
          const sharedStudentId = 'ROLL-9999';

          const studentA = await User.create({
            collegeId: collegeA._id,
            studentId: sharedStudentId,
            name: 'Alice Springfield',
            email: 'alice@springfield.edu',
            password: 'Password123!',
            role: 'student',
            status: 'active',
          });

          const studentB = await User.create({
            collegeId: collegeB._id,
            studentId: sharedStudentId,
            name: 'Bob Shelbyville',
            email: 'bob@shelbyville.edu',
            password: 'Password123!',
            role: 'student',
            status: 'active',
          });

          expect(studentA.studentId).toBe(sharedStudentId);
          expect(studentB.studentId).toBe(sharedStudentId);

          // Verify login scoping by college context
          const loginResA = await request(app).post('/api/v1/auth/login').send({
            studentId: sharedStudentId,
            password: 'Password123!',
            collegeSlug: 'springfield',
          });

          expect(loginResA.statusCode).toBe(200);
          expect(loginResA.body.user.name).toBe('Alice Springfield');
          expect(loginResA.body.user.collegeId.toString()).toBe(collegeA._id.toString());
        });
      });

      describe('4. Token-Based Activation Single-Use & Expiry', () => {
        it('verifies unactivated account cannot log in prior to activation', async () => {
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

          await User.create({
            collegeId: collegeA._id,
            studentId: 'STU-UNACT-01',
            name: 'Unactivated Student',
            email: 'unactivated@springfield.edu',
            role: 'student',
            status: 'invited',
            activationTokenHash: tokenHash,
            activationTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          });

          const loginAttempt = await request(app).post('/api/v1/auth/login').send({
            studentId: 'STU-UNACT-01',
            password: 'AnyPassword123!',
            collegeSlug: 'springfield',
          });

          expect(loginAttempt.statusCode).toBe(400);
          expect(loginAttempt.body.message).toMatch(/account has not been activated/i);
        });

        it('activates account with single-use token and invalidates token upon consumption', async () => {
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

          await User.create({
            collegeId: collegeA._id,
            studentId: 'STU-ACTIV-02',
            name: 'Token Consumer',
            email: 'tokenconsumer@springfield.edu',
            role: 'student',
            status: 'invited',
            activationTokenHash: tokenHash,
            activationTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          });

          // 1. Verify token
          const verifyRes = await request(app).get(
            `/api/v1/auth/activate/verify?token=${rawToken}`
          );
          expect(verifyRes.statusCode).toBe(200);
          expect(verifyRes.body.student.studentId).toBe('STU-ACTIV-02');

          // 2. Consume token (set password)
          const activateRes = await request(app).post('/api/v1/auth/activate/confirm').send({
            token: rawToken,
            newPassword: 'MyNewSecurePassword123!',
          });

          expect(activateRes.statusCode).toBe(200);
          expect(activateRes.body.success).toBe(true);
          expect(activateRes.body.token).toBeDefined();

          // 3. Attempt token reuse — MUST FAIL
          const reuseRes = await request(app).post('/api/v1/auth/activate/confirm').send({
            token: rawToken,
            newPassword: 'AnotherPassword123!',
          });

          expect(reuseRes.statusCode).toBe(400);
          expect(reuseRes.body.message).toMatch(/invalid or already consumed/i);
        });

        it('rejects expired activation token', async () => {
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

          await User.create({
            collegeId: collegeA._id,
            studentId: 'STU-EXPIRED-03',
            name: 'Expired Student',
            email: 'expired@springfield.edu',
            role: 'student',
            status: 'invited',
            activationTokenHash: tokenHash,
            activationTokenExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          });

          const activateRes = await request(app).post('/api/v1/auth/activate/confirm').send({
            token: rawToken,
            newPassword: 'MyNewSecurePassword123!',
          });

          expect(activateRes.statusCode).toBe(400);
          expect(activateRes.body.message).toMatch(/activation link has expired/i);
        });
      });
    });
  });

  describe('[Source: serviceCatalogAndBulkUpload.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const path = require('path');
    const fs = require('fs');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
    process.env.JWT_SECRET = 'testjwtsecretkey999';
    process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretkey999';

    jest.setTimeout(60000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Service = require('../models/Service');
    const UploadJob = require('../models/UploadJob');
    const seedServices = require('../scripts/seedServices');
    const { generateTokenPair } = require('../utils/token');

    describe('Service Catalog, Feature Flags & Bulk Student Upload Integration Tests', () => {
      let collegeA;
      let collegeB;
      let adminA;
      let superAdmin;
      let tokenAdminA;
      let tokenSuperAdmin;
      let studentA;
      let tokenStudentA;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
      });

      beforeEach(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await Service.deleteMany({});
        await UploadJob.deleteMany({});

        // Seed canonical service catalog
        await seedServices();

        // Create Tenant Colleges
        collegeA = await College.create({
          name: 'Alpha University',
          code: 'ALPHA',
          domain: 'alpha.edu',
          status: 'active',
          isActive: true,
          selectedServices: ['catalog_management'],
          enabledFeatures: ['catalog_management'],
        });

        collegeB = await College.create({
          name: 'Beta Institute',
          code: 'BETA',
          domain: 'beta.edu',
          status: 'active',
          isActive: true,
          selectedServices: ['facilities_booking'],
          enabledFeatures: ['facilities_booking'],
        });

        // Create Admin and Student users
        adminA = await User.create({
          studentId: 'ADM-A1',
          name: 'Admin Alpha',
          email: 'admin@alpha.edu',
          password: 'Password123!',
          role: 'college-admin',
          collegeId: collegeA._id,
          isEmailVerified: true,
        });
        tokenAdminA = generateTokenPair(adminA).accessToken;

        await User.create({
          studentId: 'ADM-B1',
          name: 'Admin Beta',
          email: 'admin@beta.edu',
          password: 'Password123!',
          role: 'college-admin',
          collegeId: collegeB._id,
          isEmailVerified: true,
        });

        superAdmin = await User.create({
          studentId: 'SA-99',
          name: 'Super Admin',
          email: 'superadmin@bookbuddy.app',
          password: 'SuperPassword123!',
          role: 'super-admin',
          isEmailVerified: true,
        });
        tokenSuperAdmin = generateTokenPair(superAdmin).accessToken;

        studentA = await User.create({
          studentId: 'STU-A1',
          name: 'Student Alpha',
          email: 'student@alpha.edu',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeA._id,
          isEmailVerified: true,
        });
        tokenStudentA = generateTokenPair(studentA).accessToken;
      });

      afterAll(async () => {
        // await // mongoose.connection.close();
      });

      describe('BUILD 1: Service Catalog & Feature Resolution', () => {
        it('should list available active services in catalog', async () => {
          const res = await request(app).get('/api/v1/services/available');
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(4);
        });

        it('should correctly resolve transitive dependencies (e.g. gamification -> catalog_management)', async () => {
          // Update selectedServices to ['gamification']
          const patchRes = await request(app)
            .patch(`/api/v1/services/college/${collegeA._id}/features`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              selectedServices: ['gamification'],
              featureLimits: { maxUsers: 500 },
            });

          expect(patchRes.status).toBe(200);
          expect(patchRes.body.success).toBe(true);
          expect(patchRes.body.data.selectedServices).toContain('gamification');
          // Transitive dependency catalog_management must be included automatically
          expect(patchRes.body.data.enabledFeatures).toContain('gamification');
          expect(patchRes.body.data.enabledFeatures).toContain('catalog_management');
        });

        it('should enforce tenant isolation on feature updates', async () => {
          // Admin A tries to modify College B's features
          const res = await request(app)
            .patch(`/api/v1/services/college/${collegeB._id}/features`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({ selectedServices: ['analytics'] });

          expect(res.status).toBe(403);
          expect(res.body.message).toContain('Unauthorized');
        });
      });

      describe('BUILD 2: requireFeature Middleware', () => {
        it('should reject request with 403 when feature is not enabled for tenant', async () => {
          // Student A (College A) has selectedServices: ['catalog_management'], NOT facilities_booking
          const res = await request(app)
            .get('/api/v1/lab/seats')
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(res.status).toBe(403);
          expect(res.body.message).toContain('not licensed or enabled');
        });

        it('should allow request when feature is enabled for tenant', async () => {
          // Enable facilities_booking for College A
          await request(app)
            .patch(`/api/v1/services/college/${collegeA._id}/features`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({ selectedServices: ['facilities_booking'] });

          const res = await request(app)
            .get('/api/v1/lab/seats')
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
        });

        it('should allow Super Admin to bypass feature flag restrictions', async () => {
          const res = await request(app)
            .get('/api/v1/lab/seats')
            .set('Authorization', `Bearer ${tokenSuperAdmin}`);

          expect(res.status).toBe(200);
        });
      });

      describe('BUILD 3 & 4: Bulk Student Upload Pipeline & Security Hardening', () => {
        let testCsvPath;

        beforeEach(() => {
          testCsvPath = path.join(__dirname, 'test_students.csv');
          const csvContent = [
            'name,email,studentId,department',
            'Alice Smith,alice@alpha.edu,STU-101,Computer Science',
            'Bob Jones,bob@alpha.edu,STU-102,Electrical Engineering',
            'Charlie Brown,invalid-email,STU-103,Physics', // Invalid email
            'Alice Smith,alice@alpha.edu,STU-101,Computer Science', // Duplicate in file
          ].join('\n');
          fs.writeFileSync(testCsvPath, csvContent, 'utf8');
        });

        afterEach(() => {
          if (fs.existsSync(testCsvPath)) {
            fs.unlinkSync(testCsvPath);
          }
        });

        it('should reject non-CSV file uploads with 400', async () => {
          const txtPath = path.join(__dirname, 'test.json');
          fs.writeFileSync(txtPath, JSON.stringify({ test: 123 }));

          const res = await request(app)
            .post(`/api/v1/college/${collegeA._id}/students/bulk-upload`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .attach('file', txtPath);

          if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);

          expect(res.status).toBe(400);
          expect(res.body.message).toContain('Invalid file format');
        });

        it('should reject cross-tenant upload requests with 403', async () => {
          // Admin A tries to upload to College B
          const res = await request(app)
            .post(`/api/v1/college/${collegeB._id}/students/bulk-upload`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .attach('file', testCsvPath);

          expect(res.status).toBe(403);
        });

        it('should accept valid upload, return 202 Accepted with jobId, and process records asynchronously', async () => {
          const uploadRes = await request(app)
            .post(`/api/v1/college/${collegeA._id}/students/bulk-upload`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .attach('file', testCsvPath);

          expect(uploadRes.status).toBe(202);
          expect(uploadRes.body.success).toBe(true);
          expect(uploadRes.body.data.jobId).toBeDefined();

          const jobId = uploadRes.body.data.jobId;

          // Poll status until completion
          let statusRes;
          for (let i = 0; i < 20; i++) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            statusRes = await request(app)
              .get(`/api/v1/college/${collegeA._id}/students/upload/${jobId}`)
              .set('Authorization', `Bearer ${tokenAdminA}`);

            if (statusRes.body.data.status === 'completed') {
              break;
            }
          }

          expect(statusRes.status).toBe(200);
          expect(statusRes.body.data.status).toBe('completed');
          expect(statusRes.body.data.succeededRows).toBe(2); // Alice & Bob
          expect(statusRes.body.data.failedRows).toBe(2); // Invalid email & Duplicate

          // Verify inserted students in DB have tenant collegeId and status 'invited'
          const createdAlice = await User.findOne({ email: 'alice@alpha.edu' });
          expect(createdAlice).not.toBeNull();
          expect(createdAlice.collegeId.toString()).toBe(collegeA._id.toString());
          expect(createdAlice.status).toBe('invited');
          expect(createdAlice.invitedVia).toBe('bulk_upload');

          // Verify error report URL is generated
          expect(statusRes.body.data.errorReportUrl).toBeDefined();

          // Test error report download endpoint
          const reportRes = await request(app)
            .get(`/api/v1/college/${collegeA._id}/students/upload/${jobId}/errors`)
            .set('Authorization', `Bearer ${tokenAdminA}`);

          expect(reportRes.status).toBe(200);
          expect(reportRes.header['content-type']).toContain('text/csv');
          expect(reportRes.text).toContain('Invalid email address format');
        });
      });
    });
  });

  describe('[Source: smsCredentialDelivery.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const axios = require('axios');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const StudentUploadBatch = require('../models/StudentUploadBatch');
    const { generateAccessToken } = require('../utils/token');
    const smsService = require('../services/smsService');

    jest.mock('axios');

    describe('SMS Credential Delivery & Handout Fallback Integration Tests', () => {
      let college;
      let admin;
      let adminToken;
      const originalEnv = { ...process.env };

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(
            process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test'
          );
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await StudentUploadBatch.deleteMany({});

        college = await College.create({
          name: 'Pacific Coast University',
          slug: 'pacific-coast',
          code: 'PCU',
          status: 'active',
          domain: 'pacific.edu',
        });

        admin = await User.create({
          studentId: 'ADM-PCU-001',
          name: 'College Admin',
          email: 'admin@pacific.edu',
          password: 'StrongPassword123!',
          role: 'college-admin',
          collegeId: college._id,
          status: 'active',
          isActive: true,
        });

        adminToken = generateAccessToken(admin);
      });

      afterEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
      });

      afterAll(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await StudentUploadBatch.deleteMany({});
      });

      describe('1. smsService Unit & AppSec Hardening', () => {
        it('reports isTwilioConfigured as false when env variables are missing', () => {
          delete process.env.TWILIO_SID;
          delete process.env.TWILIO_AUTH_TOKEN;
          delete process.env.TWILIO_FROM_NUMBER;

          expect(smsService.isTwilioConfigured()).toBe(false);
        });

        it('reports isTwilioConfigured as true when all credentials are set', () => {
          process.env.TWILIO_SID = 'AC_test_1234567890';
          process.env.TWILIO_AUTH_TOKEN = 'auth_token_secret_123';
          process.env.TWILIO_FROM_NUMBER = '+15550001111';

          expect(smsService.isTwilioConfigured()).toBe(true);
        });

        it('masks phone numbers to protect student privacy and PII in logs', () => {
          expect(smsService.maskPhoneNumber('+15551234567')).toBe('+15***4567');
          expect(smsService.maskPhoneNumber('5551234567')).toBe('555***4567');
          expect(smsService.maskPhoneNumber('')).toBe('***');
        });

        it('returns fallbackToHandout: true when Twilio is unconfigured', async () => {
          delete process.env.TWILIO_SID;
          delete process.env.TWILIO_AUTH_TOKEN;
          delete process.env.TWILIO_FROM_NUMBER;

          const result = await smsService.sendCredentialSMS({
            to: '+15551234567',
            studentId: 'STU-001',
            tempPassword: 'TempPassword1!',
            name: 'Jane Doe',
          });

          expect(result.success).toBe(false);
          expect(result.fallbackToHandout).toBe(true);
          expect(result.reason).toContain('not configured');
        });

        it('dispatches HTTP Basic Auth request to Twilio API when configured', async () => {
          process.env.TWILIO_SID = 'AC_mock_sid';
          process.env.TWILIO_AUTH_TOKEN = 'mock_secret_token';
          process.env.TWILIO_FROM_NUMBER = '+15550001111';

          axios.post.mockResolvedValueOnce({
            data: { sid: 'SM_test_message_id_123', status: 'queued' },
          });

          const result = await smsService.sendCredentialSMS({
            to: '+15551234567',
            studentId: 'STU-001',
            tempPassword: 'TempPassword1!',
            name: 'Jane Doe',
            collegeName: 'Pacific Coast',
            collegeSlug: 'pacific-coast',
          });

          expect(result.success).toBe(true);
          expect(result.messageId).toBe('SM_test_message_id_123');
          expect(result.fallbackToHandout).toBe(false);

          expect(axios.post).toHaveBeenCalledTimes(1);
          const [url, body, options] = axios.post.mock.calls[0];
          expect(url).toContain('AC_mock_sid/Messages.json');
          expect(body).toContain('To=%2B15551234567');
          expect(body).toContain('From=%2B15550001111');
          expect(body).toContain('STU-001');
          expect(options.headers.Authorization).toContain('Basic ');
        });

        it('falls back to handout if Twilio API returns an error', async () => {
          process.env.TWILIO_SID = 'AC_mock_sid';
          process.env.TWILIO_AUTH_TOKEN = 'mock_secret_token';
          process.env.TWILIO_FROM_NUMBER = '+15550001111';

          axios.post.mockRejectedValueOnce(new Error('Twilio Network Gateway Timeout'));

          const result = await smsService.sendCredentialSMS({
            to: '+15551234567',
            studentId: 'STU-001',
            tempPassword: 'TempPassword1!',
            name: 'Jane Doe',
          });

          expect(result.success).toBe(false);
          expect(result.fallbackToHandout).toBe(true);
          expect(result.error).toContain('Twilio Network Gateway Timeout');
        });
      });

      describe('2. Student Roster Bulk-Upload SMS Delivery & Handout Fallback Flow', () => {
        it('triggers SMS dispatch for phone-only student when Twilio is configured', async () => {
          process.env.TWILIO_SID = 'AC_test_configured';
          process.env.TWILIO_AUTH_TOKEN = 'auth_configured_secret';
          process.env.TWILIO_FROM_NUMBER = '+15558889999';

          axios.post.mockResolvedValueOnce({
            data: { sid: 'SM_bulk_001', status: 'queued' },
          });

          // CSV with phone-only student
          const csvData =
            'StudentId,Name,Phone,Program,Year\n' +
            'STU-PHONE-1,Alex PhoneOnly,+15559876543,Engineering,Year 1\n';

          const validateRes = await request(app)
            .post('/api/admin/students/upload/validate')
            .set('Authorization', `Bearer ${adminToken}`)
            .attach('file', Buffer.from(csvData), 'roster_phone.csv');

          expect(validateRes.status).toBe(200);
          const batchId = validateRes.body.batchId;
          const validRows = validateRes.body.validRowsPayload;

          // Commit the batch
          const commitRes = await request(app)
            .post('/api/admin/students/upload/commit')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ batchId, validRows });

          expect(commitRes.status).toBe(202);

          // Wait for background commit processing
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const statusCheck = await request(app)
              .get(`/api/admin/students/upload/${batchId}/status`)
              .set('Authorization', `Bearer ${adminToken}`);
            if (statusCheck.body.batch?.status === 'committed') break;
          }

          // Verify delivery status
          const statusRes = await request(app)
            .get(`/api/admin/students/upload/${batchId}/delivery-status`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(statusRes.status).toBe(200);
          expect(statusRes.body.summary.sms_queued).toBe(1);
          expect(statusRes.body.summary.sent).toBe(1);
          expect(statusRes.body.hasCredentialSlips).toBe(false);

          const studentRecord = await User.findOne({
            collegeId: college._id,
            studentId: 'stu-phone-1',
          });
          expect(studentRecord).toBeTruthy();
          expect(studentRecord.status).toBe('invited');
          expect(studentRecord.phone).toContain('15559876543');
        });

        it('falls back to printed handout when phone-only student uploaded without Twilio credentials', async () => {
          delete process.env.TWILIO_SID;
          delete process.env.TWILIO_AUTH_TOKEN;
          delete process.env.TWILIO_FROM_NUMBER;

          const csvData =
            'StudentId,Name,Phone,Program,Year\n' +
            'STU-NO-TWILIO,Bob Offline,+15551112222,Arts,Year 2\n';

          const validateRes = await request(app)
            .post('/api/admin/students/upload/validate')
            .set('Authorization', `Bearer ${adminToken}`)
            .attach('file', Buffer.from(csvData), 'roster_no_twilio.csv');

          expect(validateRes.status).toBe(200);
          const batchId = validateRes.body.batchId;
          const validRows = validateRes.body.validRowsPayload;

          const commitRes = await request(app)
            .post('/api/admin/students/upload/commit')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ batchId, validRows });

          expect(commitRes.status).toBe(202);

          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const statusCheck = await request(app)
              .get(`/api/admin/students/upload/${batchId}/status`)
              .set('Authorization', `Bearer ${adminToken}`);
            if (statusCheck.body.batch?.status === 'committed') break;
          }

          const statusRes = await request(app)
            .get(`/api/admin/students/upload/${batchId}/delivery-status`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(statusRes.status).toBe(200);
          expect(statusRes.body.summary.no_contact_info).toBe(1);
          expect(statusRes.body.hasCredentialSlips).toBe(true);

          // Verify printed handout export endpoint returns the slip
          const handoutRes = await request(app)
            .get(`/api/admin/students/upload/${batchId}/handouts`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(handoutRes.status).toBe(200);
          expect(handoutRes.headers['content-type']).toContain('text/csv');
          expect(handoutRes.text).toContain('STU-NO-TWILIO');
          expect(handoutRes.text).toContain('Bob Offline');
          expect(handoutRes.text).toContain('printed_handout');
        });

        it('falls back to printed handout when Twilio dispatch fails for phone-only student', async () => {
          process.env.TWILIO_SID = 'AC_test_configured';
          process.env.TWILIO_AUTH_TOKEN = 'auth_configured_secret';
          process.env.TWILIO_FROM_NUMBER = '+15558889999';

          // Simulate Twilio rejecting dispatch (e.g. invalid handset)
          axios.post.mockRejectedValueOnce({
            response: { data: { message: 'Carrier lookup failed: invalid phone number' } },
          });

          const csvData =
            'StudentId,Name,Phone,Program,Year\n' +
            'STU-FAIL-SMS,Carol Failed,+15559990000,Science,Year 3\n';

          const validateRes = await request(app)
            .post('/api/admin/students/upload/validate')
            .set('Authorization', `Bearer ${adminToken}`)
            .attach('file', Buffer.from(csvData), 'roster_fail.csv');

          expect(validateRes.status).toBe(200);
          const batchId = validateRes.body.batchId;
          const validRows = validateRes.body.validRowsPayload;

          await request(app)
            .post('/api/admin/students/upload/commit')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ batchId, validRows });

          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const statusCheck = await request(app)
              .get(`/api/admin/students/upload/${batchId}/status`)
              .set('Authorization', `Bearer ${adminToken}`);
            if (statusCheck.body.batch?.status === 'committed') break;
          }

          const statusRes = await request(app)
            .get(`/api/admin/students/upload/${batchId}/delivery-status`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(statusRes.status).toBe(200);
          expect(statusRes.body.summary.no_contact_info).toBe(1);
          expect(statusRes.body.hasCredentialSlips).toBe(true);

          // Verify printed handout export endpoint returns the slip
          const handoutRes = await request(app)
            .get(`/api/admin/students/upload/${batchId}/handouts`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(handoutRes.status).toBe(200);
          expect(handoutRes.text).toContain('STU-FAIL-SMS');
          expect(handoutRes.text).toContain('Carol Failed');
          expect(handoutRes.text).toContain('printed_handout');
        });
      });
    });
  });

  describe('[Source: emailFallback.test.js]', () => {
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Loan = require('../models/Loan');
    const { returnBook } = require('../services/loanService');
    const { sendNotificationWithEmailFallback } = require('../services/emailService');
    const mailer = require('../utils/mailer');

    describe('Email Fallback via Nodemailer for Offline Users', () => {
      let college;
      let offlineUser;
      let book;
      let loan;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const uri =
            process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_email_fallback_test';
          await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 2000,
            connectTimeoutMS: 2000,
          });
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Loan.deleteMany({});

        college = await College.create({ name: 'Email Test College', code: 'ETC' });
        offlineUser = await User.create({
          studentId: 'OFFLINE_001',
          name: 'Offline User',
          email: 'offline.user@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });
        book = await Book.create({
          collegeId: college._id,
          isbn: '978-5555555555',
          title: 'Email Fallback Testing Book',
          author: 'Email Author',
          category: 'Science',
          copiesTotal: 1,
          copiesAvailable: 0,
        });
        loan = await Loan.create({
          collegeId: college._id,
          userId: offlineUser._id,
          bookId: book._id,
          issuedBy: offlineUser._id,
          maxRenewals: 2,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'active',
        });
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await Loan.deleteMany({});
          await Book.deleteMany({});
          await User.deleteMany({});
          await College.deleteMany({});
        }
      });

      test('sendNotificationWithEmailFallback dispatches email when user has no active socket', async () => {
        const queueEmailSpy = jest.spyOn(mailer, 'queueEmail');

        const result = await sendNotificationWithEmailFallback(
          offlineUser._id,
          'book_returned',
          'Your borrowed book was returned.',
          { subject: 'Book Return Test' }
        );

        expect(result.online).toBe(false);
        expect(result.emailSent).toBe(true);
        expect(queueEmailSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'offline.user@test.com',
            subject: 'Book Return Test',
          })
        );

        queueEmailSpy.mockRestore();
      });

      test('Acceptance Criteria: Simulating an offline user (no active socket) at the moment of book return results in an email being sent', async () => {
        const queueEmailSpy = jest.spyOn(mailer, 'queueEmail');

        const returnedLoan = await returnBook(loan._id, college._id);
        expect(returnedLoan.status).toBe('returned');

        // Verify email was dispatched to the offline user for book return
        expect(queueEmailSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'offline.user@test.com',
            subject: expect.stringContaining('Book Return Confirmation'),
          })
        );

        queueEmailSpy.mockRestore();
      });
    });
  });
});
