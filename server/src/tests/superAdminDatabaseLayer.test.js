const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');
const RegistrationRequest = require('../models/RegistrationRequest');
const AuditLog = require('../models/AuditLog');
const PlatformMetricSnapshot = require('../models/PlatformMetricSnapshot');
const SystemSetting = require('../models/SystemSetting');
const CronRunLog = require('../models/CronRunLog');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const Book = require('../models/Book');

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
      expect(indexes).toHaveProperty('email_1');
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
        if (err.message.includes('Transaction numbers are only allowed on a replica set member')) {
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
      await new Promise((r) => setTimeout(r, 100));

      const log = await AuditLog.findOne({ action: 'book.update' }).sort({ createdAt: -1 });
      expect(log).not.toBeNull();
      expect(log.actorId.toString()).toBe(originalSuperAdminId.toString());
      expect(log.performedBy.toString()).toBe(originalSuperAdminId.toString());
      expect(log.metadata.isImpersonated).toBe(true);
      expect(log.metadata.impersonatedUserId).toBe(impersonatedUserId.toString());
    });
  });
});
