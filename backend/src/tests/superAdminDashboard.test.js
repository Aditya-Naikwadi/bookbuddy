/**
 * Consolidated Suite: Super Admin Dashboard & Data Integrity
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('Super Admin Dashboard Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: superAdminDashboard.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecretkey999';

    jest.setTimeout(30000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const AuditLog = require('../models/AuditLog');
    const Complaint = require('../models/Complaint');
    const SystemSetting = require('../models/SystemSetting');
    const { generateAccessToken } = require('../utils/token');

    describe('Super Admin Dashboard Comprehensive Integration Test Suite', () => {
      let superAdminToken;
      let superAdminUser;
      let collegeAdminToken;
      let collegeAdminUser;
      let studentToken;
      let studentUser;
      let testCollege;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
          });
        }

        // Clean up any lingering test records
        await College.deleteMany({ code: 'TESTUNIV' });
        await User.deleteMany({ studentId: { $in: ['SA-001', 'CA-001', 'STU-001'] } });
        await User.deleteMany({
          email: {
            $in: ['superadmin@bookbuddy.internal', 'admin@testuniv.edu', 'jane@testuniv.edu'],
          },
        });

        // Create test college tenant
        testCollege = await College.create({
          name: 'Test University',
          code: 'TESTUNIV',
          slug: 'test-univ',
          domain: 'testuniv.edu',
          status: 'active',
        });

        // Create super-admin user
        superAdminUser = await User.create({
          studentId: 'SA-001',
          name: 'Super Admin Operator',
          email: 'superadmin@bookbuddy.internal',
          password: 'SuperAdminPass123!',
          role: 'super-admin',
          status: 'active',
          membershipStatus: 'active',
        });
        superAdminToken = generateAccessToken(superAdminUser);

        // Create college-admin user
        collegeAdminUser = await User.create({
          studentId: 'CA-001',
          name: 'College Admin Operator',
          email: 'admin@testuniv.edu',
          password: 'CollegeAdminPass123!',
          role: 'college-admin',
          collegeId: testCollege._id,
          status: 'active',
          membershipStatus: 'active',
        });
        collegeAdminToken = generateAccessToken(collegeAdminUser);

        // Create student user
        studentUser = await User.create({
          studentId: 'STU-001',
          name: 'Jane Student',
          email: 'jane@testuniv.edu',
          password: 'StudentPass123!',
          role: 'student',
          collegeId: testCollege._id,
          status: 'active',
          membershipStatus: 'active',
        });
        studentToken = generateAccessToken(studentUser);
      });

      afterAll(async () => {
        await College.deleteMany({ code: 'TESTUNIV' });
        await User.deleteMany({
          $or: [
            {
              email: {
                $in: ['superadmin@bookbuddy.internal', 'admin@testuniv.edu', 'jane@testuniv.edu'],
              },
            },
            { studentId: { $in: ['SA-001', 'CA-001', 'STU-001'] } },
          ],
        });
      });

      describe('RBAC & Security Middleware Enforcements', () => {
        it('should reject unauthenticated access to admin portal routes with 401', async () => {
          const res = await request(app).get('/api/v1/dashboards/admin-portal/users');
          expect(res.status).toBe(401);
        });

        it('should reject college-admin access to super-admin routes with 403', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/admin-portal/users')
            .set('Authorization', `Bearer ${collegeAdminToken}`);
          expect(res.status).toBe(403);
        });

        it('should reject student access to super-admin routes with 403', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/admin-portal/users')
            .set('Authorization', `Bearer ${studentToken}`);
          expect(res.status).toBe(403);
        });

        it('should allow super-admin access with 200', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/admin-portal/users')
            .set('Authorization', `Bearer ${superAdminToken}`);
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
        });
      });

      describe('PHASE 1: Global User Management & Settings Integration', () => {
        it('GET /users - should support searching by name and filtering by role', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/admin-portal/users?search=Jane&role=student')
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.data.length).toBeGreaterThan(0);
          expect(res.body.data[0].email).toBe('jane@testuniv.edu');
        });

        it('PATCH /users/:id/status - should update status and create AuditLog entry', async () => {
          const res = await request(app)
            .patch(`/api/v1/dashboards/admin-portal/users/${studentUser._id}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'disabled', membershipStatus: 'suspended' });

          expect(res.status).toBe(200);
          expect(res.body.data.status).toBe('disabled');

          // Verify AuditLog
          const log = await AuditLog.findOne({
            action: 'user.status_update',
            targetId: studentUser._id,
          });
          expect(log).not.toBeNull();
          expect(log.actorId.toString()).toBe(superAdminUser._id.toString());
        });

        it('PATCH /users/:id/role - should update role and create AuditLog entry', async () => {
          const res = await request(app)
            .patch(`/api/v1/dashboards/admin-portal/users/${studentUser._id}/role`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ role: 'college-admin' });

          expect(res.status).toBe(200);
          expect(res.body.data.role).toBe('college-admin');

          // Revert role back for clean state
          await User.findByIdAndUpdate(studentUser._id, {
            role: 'student',
            status: 'active',
            membershipStatus: 'active',
          });
        });

        it('POST /users/:id/reset-password - should generate temporary password and log action', async () => {
          const res = await request(app)
            .post(`/api/v1/dashboards/admin-portal/users/${studentUser._id}/reset-password`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({});

          expect(res.status).toBe(200);
          expect(res.body.tempPassword).toBeDefined();

          const log = await AuditLog.findOne({
            action: 'user.reset_password',
            targetId: studentUser._id,
          });
          expect(log).not.toBeNull();
        });

        it('POST /users/:id/impersonate - should generate short-lived access token and create AuditLog entry', async () => {
          const res = await request(app)
            .post(`/api/v1/dashboards/admin-portal/users/${studentUser._id}/impersonate`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({});

          expect(res.status).toBe(200);
          expect(res.body.token).toBeDefined();

          const log = await AuditLog.findOne({
            action: 'user.impersonate',
            targetId: studentUser._id,
          });
          expect(log).not.toBeNull();
        });

        it('GET & PUT /settings - should retrieve and update system settings', async () => {
          const getRes = await request(app)
            .get('/api/v1/dashboards/admin-portal/settings')
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(getRes.status).toBe(200);
          expect(getRes.body.data.smtpHost).toBeDefined();

          const putRes = await request(app)
            .put('/api/v1/dashboards/admin-portal/settings')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ smtpHost: 'smtp.testdomain.com', smtpPort: 465 });

          expect(putRes.status).toBe(200);

          const updated = await SystemSetting.findOne({ key: 'smtpHost' });
          expect(updated.value).toBe('smtp.testdomain.com');
        });

        it('POST /settings/trigger-backup - should initiate manual backup dump and log audit action', async () => {
          const res = await request(app)
            .post('/api/v1/dashboards/admin-portal/settings/trigger-backup')
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.filename).toContain('backup-');

          const log = await AuditLog.findOne({
            action: 'system_backup.trigger',
          });
          expect(log).not.toBeNull();
        });
      });

      describe('PHASE 2: System Telemetry, Cron Logs & Data Oversight', () => {
        it('GET /system/health - should return process memory, uptime, DB state, and Redis health', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/admin-portal/system/health')
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.data.memoryUsage).toBeDefined();
          expect(res.body.data.database.status).toBe('connected');
        });

        it('GET /system/cron-logs - should return background job logs', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/admin-portal/system/cron-logs')
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.data).toBeDefined();
        });

        it('GET /data/loans - should return global loans across institutions', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/admin-portal/data/loans')
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(res.status).toBe(200);
          expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('GET /support/complaints & PATCH /support/complaints/:id - should manage support tickets', async () => {
          const testComplaint = await Complaint.create({
            submittedBy: studentUser._id,
            collegeId: testCollege._id,
            subject: 'Book Access Issue',
            description: 'Cannot download EPUB file',
            status: 'open',
          });

          const getRes = await request(app)
            .get('/api/v1/dashboards/admin-portal/support/complaints')
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(getRes.status).toBe(200);
          expect(getRes.body.data.length).toBeGreaterThan(0);

          const patchRes = await request(app)
            .patch(`/api/v1/dashboards/admin-portal/support/complaints/${testComplaint._id}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'resolved', adminResponse: 'File permissions updated.' });

          expect(patchRes.status).toBe(200);
          expect(patchRes.body.data.status).toBe('resolved');

          await Complaint.findByIdAndDelete(testComplaint._id);
        });

        it('PATCH /users/:id/status - should reject invalid status enum with 400', async () => {
          const res = await request(app)
            .patch(`/api/v1/dashboards/admin-portal/users/${studentUser._id}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'invalid_status_enum' });

          expect(res.status).toBe(400);
          expect(res.body.message).toMatch(/Validation Error|Invalid/);
        });

        it('PATCH /support/complaints/:id - should reject invalid complaint status enum with 400', async () => {
          const testComplaint = await Complaint.create({
            submittedBy: studentUser._id,
            collegeId: testCollege._id,
            subject: 'Test Complaint',
            description: 'Test Description',
            status: 'open',
          });

          const res = await request(app)
            .patch(`/api/v1/dashboards/admin-portal/support/complaints/${testComplaint._id}`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'invalid_complaint_status' });

          expect(res.status).toBe(400);
          expect(res.body.message).toContain('Invalid complaint status');

          await Complaint.findByIdAndDelete(testComplaint._id);
        });
      });
    });
  });
  describe('[Source: superAdminDataDesign.test.js]', () => {
    const mongoose = require('mongoose');
    const College = require('../models/College');
    const PendingAdminSetup = require('../models/PendingAdminSetup');
    const PlatformMetricSnapshot = require('../models/PlatformMetricSnapshot');
    const EResource = require('../models/EResource');
    const AuditLog = require('../models/AuditLog');

    describe('Super Admin Portal Data Layer Implementation Tests', () => {
      describe('Module 1: Platform Metric Snapshot Schema', () => {
        it('1. should instantiate PlatformMetricSnapshot with complete metric structures and default values', () => {
          const snapshot = new PlatformMetricSnapshot({
            totalColleges: 10,
            activeColleges: 8,
            pendingColleges: 2,
            totalStudents: 1500,
            activeStudents: 1200,
            activeAdmins: 15,
            featureAdoptionBreakdown: [{ featureKey: 'digital_library', collegeCount: 8 }],
            eResourceMetrics: {
              totalUploaded: 250,
              pendingModeration: 12,
              approvedCount: 220,
              rejectedCount: 18,
            },
          });

          expect(snapshot.totalColleges).toBe(10);
          expect(snapshot.activeColleges).toBe(8);
          expect(snapshot.totalStudents).toBe(1500);
          expect(snapshot.featureAdoptionBreakdown[0].featureKey).toBe('digital_library');
          expect(snapshot.eResourceMetrics.pendingModeration).toBe(12);
        });

        it('2. should export model under both PlatformMetricSnapshot and PlatformMetricsSnapshot aliases', () => {
          expect(mongoose.models.PlatformMetricSnapshot).toBeDefined();
          expect(mongoose.models.PlatformMetricsSnapshot).toBeDefined();
        });
      });

      describe('Module 2: College & PendingAdminSetup Schemas', () => {
        it('3. should synchronize createdVia and creationPath on College pre-save', async () => {
          const college = new College({
            name: 'Test Engineering Institute',
            code: 'TEI001',
            createdVia: 'operator_direct',
          });

          await college.validate();
          expect(college.createdVia).toBe('operator_direct');
          expect(college.creationPath).toBe('operator_direct');
        });

        it('4. should support PendingAdminSetup hashed token schema and consumedAt field', () => {
          const dummyId = new mongoose.Types.ObjectId();
          const dummyCollegeId = new mongoose.Types.ObjectId();
          const now = new Date();

          const setup = new PendingAdminSetup({
            userId: dummyId,
            collegeId: dummyCollegeId,
            hashedSetupToken: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            expiresAt: new Date(Date.now() + 172800000),
            consumed: true,
            consumedAt: now,
          });

          expect(setup.hashedSetupToken).toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          );
          expect(setup.consumed).toBe(true);
          expect(setup.consumedAt).toBe(now);
        });
      });

      describe('Module 3: E-Resource Moderation Schema', () => {
        it('5. should decouple moderationStatus and isPublished state, syncing aliases and history', async () => {
          const dummyUserId = new mongoose.Types.ObjectId();
          const dummyCollegeId = new mongoose.Types.ObjectId();

          const resource = new EResource({
            collegeId: dummyCollegeId,
            title: 'Quantum Computing Handbook',
            author: 'Dr. Jane Smith',
            type: 'pdf',
            fileUrl: 'https://s3.amazonaws.com/bookbuddy/res1.pdf',
            uploadedBy: dummyUserId,
            category: 'Physics',
            moderationStatus: 'approved',
            isPublished: true,
            publishedAt: new Date(),
            moderationHistory: [
              {
                status: 'approved',
                moderatedBy: dummyUserId,
                moderatedAt: new Date(),
                rejectionReason: null,
              },
            ],
          });

          await resource.validate();
          expect(resource.moderationStatus).toBe('approved');
          expect(resource.isPublished).toBe(true);
          expect(resource.publishedAt).toBeDefined();
          expect(resource.submittedBy.toString()).toBe(dummyUserId.toString());
          expect(resource.moderationHistory.length).toBe(1);
        });
      });

      describe('Module 4: Centralized Security Audit Log Schema & Hardening', () => {
        it('6. should synchronize root actor/target with nested actor/target objects', async () => {
          const dummyActorId = new mongoose.Types.ObjectId();
          const dummyTargetId = new mongoose.Types.ObjectId();

          const auditLog = new AuditLog({
            actorId: dummyActorId,
            actorRole: 'super_admin',
            action: 'tenant.created',
            targetType: 'College',
            targetId: dummyTargetId,
            severity: 'routine',
            ipAddress: '127.0.0.1',
          });

          // Trigger pre-save sync logic manually for validation testing
          const nextFn = jest.fn();
          auditLog.isNew = true;
          if (auditLog.schema.s?.hooks?.execPre) {
            auditLog.schema.s.hooks.execPre('save', auditLog, [nextFn]);
          } else if (auditLog.schema.s?.hooks?.exec) {
            auditLog.schema.s.hooks.exec('pre', 'save', auditLog, [nextFn]);
          } else {
            await auditLog.validate().catch(() => {});
          }

          expect(auditLog.actionType).toBe('tenant.created');
          expect(auditLog.actor.userId.toString()).toBe(dummyActorId.toString());
          expect(auditLog.actor.role).toBe('super_admin');
          expect(auditLog.target.targetId.toString()).toBe(dummyTargetId.toString());
          expect(auditLog.target.targetType).toBe('College');
        });

        it('7. should enforce immutability on non-new AuditLog instance save', async () => {
          const auditLog = new AuditLog({
            action: 'tenant.created',
            ipAddress: '127.0.0.1',
          });

          auditLog.isNew = false;
          const nextFn = jest.fn();

          try {
            if (auditLog.schema.s?.hooks?.execPre) {
              auditLog.schema.s.hooks.execPre('save', auditLog, [nextFn]);
            } else if (auditLog.schema.s?.hooks?.exec) {
              auditLog.schema.s.hooks.exec('pre', 'save', auditLog, [nextFn]);
            } else {
              await auditLog.validate();
            }
          } catch (err) {
            nextFn(err);
          }
          expect(nextFn).toHaveBeenCalledWith(expect.any(Error));
          expect(nextFn.mock.calls[0][0].message).toContain('immutable');
        });

        it('8. should register model alias AuditLogEntry in mongoose.models', () => {
          expect(mongoose.models.AuditLog).toBeDefined();
          expect(mongoose.models.AuditLogEntry).toBeDefined();
        });
      });
    });
  });
  describe('[Source: superAdminDatabaseLayer.test.js]', () => {
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const College = require('../models/College');
    const AuditLog = require('../models/AuditLog');
    const PlatformMetricSnapshot = require('../models/PlatformMetricSnapshot');
    const CronRunLog = require('../models/CronRunLog');
    const Loan = require('../models/Loan');

    describe('Super Admin Database Layer Verification Test Suite', () => {
      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const config = require('../config');
          await mongoose.connect(config.mongoUri);
        }
        await User.syncIndexes();
        await College.syncIndexes();
        await AuditLog.syncIndexes();
        await PlatformMetricSnapshot.syncIndexes();
        await CronRunLog.syncIndexes();
        await Loan.syncIndexes();
      });

      describe('STAGE 1 & 2: Schema & Index Verification', () => {
        it('1. should verify indexes on User collection', async () => {
          const indexes = await User.collection.getIndexes();
          expect(indexes).toHaveProperty('collegeId_1_email_1');
          expect(indexes).toHaveProperty('role_1_collegeId_1_status_1');
        });

        it('2. should verify indexes on College collection', async () => {
          const indexes = await College.collection.getIndexes();
          expect(indexes).toHaveProperty('code_1');
          expect(indexes).toHaveProperty('status_1_subscriptionPlan_1');
        });

        it('3. should verify AuditLog has indefinite retention (NO TTL INDEX)', async () => {
          const indexes = await AuditLog.collection.getIndexes();
          const ttlIndexKey = Object.keys(indexes).find((k) =>
            indexes[k].some((i) => i.expireAfterSeconds)
          );
          expect(ttlIndexKey).toBeUndefined();
        });

        it('4. should verify indexes on PlatformMetricSnapshot and CronRunLog', async () => {
          const snapshotIndexes = await PlatformMetricSnapshot.collection.getIndexes();
          expect(snapshotIndexes).toHaveProperty('collegeId_1_snapshotDate_-1');

          const cronIndexes = await CronRunLog.collection.getIndexes();
          expect(cronIndexes).toHaveProperty('jobName_1');
        });
      });

      describe('STAGE 2: explain() Plan Verification (Proving IXSCAN vs COLLSCAN)', () => {
        it('5. should confirm IXSCAN on PlatformMetricSnapshot overview query', async () => {
          const explanation = await PlatformMetricSnapshot.find({ collegeId: null })
            .sort({ snapshotDate: -1 })
            .explain('executionStats');

          const winningStage =
            explanation.queryPlanner?.winningPlan?.queryPlan?.stage ||
            explanation.queryPlanner?.winningPlan?.stage ||
            explanation.executionStats?.executionStages?.stage;

          const isIndexUsed = JSON.stringify(explanation).includes('IXSCAN');
          expect(winningStage || isIndexUsed).toBeDefined();
          expect(isIndexUsed).toBe(true);
        });

        it('6. should confirm IXSCAN on Loan cross-tenant data oversight query', async () => {
          const sampleCollegeId = new mongoose.Types.ObjectId();
          const explanation = await Loan.find({ collegeId: sampleCollegeId, status: 'active' })
            .sort({ createdAt: -1 })
            .explain('executionStats');

          const isIndexUsed = JSON.stringify(explanation).includes('IXSCAN');
          expect(isIndexUsed).toBe(true);
        });

        it('7. should confirm IXSCAN on AuditLog search query', async () => {
          const sampleActorId = new mongoose.Types.ObjectId();
          const explanation = await AuditLog.find({ actorId: sampleActorId })
            .sort({ createdAt: -1 })
            .explain('executionStats');

          const isIndexUsed = JSON.stringify(explanation).includes('IXSCAN');
          expect(isIndexUsed).toBe(true);
        });
      });

      describe('STAGE 3: Data Integrity, Transactions & Impersonation Integrity', () => {
        it('8. should enforce DB-level unique constraint on College code', async () => {
          const uniqueCode = `TEST_UNIQ_${Date.now()}`;
          await College.create({
            name: 'Test University A',
            code: uniqueCode,
            status: 'active',
          });

          let duplicateError = null;
          try {
            await College.create({
              name: 'Test University B',
              code: uniqueCode,
              status: 'active',
            });
          } catch (err) {
            duplicateError = err;
          }

          expect(duplicateError).not.toBeNull();
          expect(duplicateError.code).toBe(11000); // Mongo duplicate key code
        });

        it('9. should perform transaction rollback cleanly on mid-onboarding approval failure', async () => {
          const session = await mongoose.startSession();
          const uniqueCode = `ROLLBACK_${Date.now()}`;
          const uniqueEmail = `rollback_${Date.now()}@test.com`;

          let sessionSupported = true;
          try {
            session.startTransaction();

            // Step 1: Create College doc
            const [college] = await College.create(
              [
                {
                  name: 'Rollback Test University',
                  code: uniqueCode,
                  status: 'active',
                },
              ],
              { session }
            );

            // Step 2: Create Admin User doc
            await User.create(
              [
                {
                  studentId: 'RB-001',
                  name: 'Rollback Admin',
                  email: uniqueEmail,
                  password: 'Password123!',
                  role: 'college-admin',
                  collegeId: college._id,
                },
              ],
              { session }
            );

            // Step 3: Simulate mid-approval unexpected failure
            throw new Error('Simulated atomic transaction failure');
          } catch (err) {
            if (
              err.message.includes('Transaction numbers are only allowed on a replica set member')
            ) {
              sessionSupported = false;
            } else {
              await session.abortTransaction();
            }
          } finally {
            session.endSession();
          }

          if (sessionSupported) {
            // Assert that neither document persists in DB
            const foundCollege = await College.findOne({ code: uniqueCode });
            const foundUser = await User.findOne({ email: uniqueEmail });
            expect(foundCollege).toBeNull();
            expect(foundUser).toBeNull();
          }
        });

        it('10. should store originalSuperAdminId in AuditLog performedBy/actorId during impersonation write', async () => {
          const originalSuperAdminId = new mongoose.Types.ObjectId();
          const impersonatedUserId = new mongoose.Types.ObjectId();

          const reqMock = {
            user: {
              id: impersonatedUserId.toString(),
              _id: impersonatedUserId,
              role: 'student',
              isImpersonated: true,
              originalSuperAdminId: originalSuperAdminId.toString(),
            },
            ip: '127.0.0.1',
            headers: {},
            socket: {},
          };

          const auditLogMiddleware = require('../middlewares/auditLog');
          const resMock = {
            statusCode: 200,
            locals: {
              auditMeta: {
                targetType: 'Book',
                targetId: new mongoose.Types.ObjectId(),
                metadata: { title: 'Test Book' },
              },
            },
            on: (evt, cb) => cb(),
          };

          const nextMock = jest.fn();
          auditLogMiddleware('book.update')(reqMock, resMock, nextMock);

          // Wait brief tick for audit log write
          await new Promise((r) => setTimeout(r, 300));

          const log = await AuditLog.findOne({ action: 'book.update' }).sort({ createdAt: -1 });
          expect(log).not.toBeNull();
          expect(log.actorId.toString()).toBe(originalSuperAdminId.toString());
          expect(log.performedBy.toString()).toBe(originalSuperAdminId.toString());
          expect(log.metadata.isImpersonated).toBe(true);
          expect(log.metadata.impersonatedUserId).toBe(impersonatedUserId.toString());
        });
      });
    });
  });
});
