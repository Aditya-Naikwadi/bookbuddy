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
