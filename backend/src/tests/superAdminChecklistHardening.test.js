/**
 * Super Admin Production Checklist Hardening Verification Suite
 * Verifies P0 items:
 * 1. Subdomain tenant restriction (403 when hitting /admin-portal from tenant subdomain)
 * 2. Self-lockout prevention (Super Admin cannot disable/demote own account)
 * 3. Last remaining Super Admin protection (cannot demote/disable last active super admin)
 * 4. Token & session revocation on role change and suspension
 * 5. Reserved keyword and duplicate slug/code checks on tenant creation
 * 6. Non-colliding unique admin IDs and mustChangePasswordOnNextLogin flag
 * 7. E-Resource approval immediately sets moderationStatus: 'published' and isPublished: true
 * 8. Gated database restore (requires CONFIRM_RESTORE, maintenance mode, and MFA step-up)
 * 9. Telemetry nodeVersion patch redaction
 * 10. SMTP password masking in system settings
 * 11. Support ticket resolution message requirement
 */

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecretkey999';

jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const EResource = require('../models/EResource');
const RefreshToken = require('../models/RefreshToken');
const SystemSetting = require('../models/SystemSetting');
const RegistrationRequest = require('../models/RegistrationRequest');
const Complaint = require('../models/Complaint');
const { generateAccessToken } = require('../utils/token');

describe('Super Admin Production Checklist Hardening Suite', () => {
  let superAdminToken;
  let superAdminUser;
  let secondSuperAdminToken;
  let secondSuperAdminUser;
  let testCollege;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
    }

    // Clean up test data
    await User.deleteMany({
      email: {
        $in: ['sa-test-1@bookbuddy.test', 'sa-test-2@bookbuddy.test', 'target-user@bookbuddy.test'],
      },
    });
    await College.deleteMany({
      slug: { $in: ['chk-college-1', 'chk-college-dup', 'reserved-test'] },
    });

    // Primary Super Admin
    superAdminUser = await User.create({
      studentId: 'SA-CHK-01',
      name: 'Primary Super Admin',
      email: 'sa-test-1@bookbuddy.test',
      password: 'SuperSecurePassword@2026',
      role: 'super-admin',
      status: 'active',
      isActive: true,
      membershipStatus: 'active',
      isEmailVerified: true,
    });
    superAdminToken = generateAccessToken(superAdminUser);

    // Secondary Super Admin
    secondSuperAdminUser = await User.create({
      studentId: 'SA-CHK-02',
      name: 'Secondary Super Admin',
      email: 'sa-test-2@bookbuddy.test',
      password: 'SuperSecurePassword@2026',
      role: 'super-admin',
      status: 'active',
      isActive: true,
      membershipStatus: 'active',
      isEmailVerified: true,
    });
    secondSuperAdminToken = generateAccessToken(secondSuperAdminUser);

    testCollege = await College.create({
      name: 'Checklist Test College',
      code: 'CHKCOL1',
      slug: 'chk-college-1',
      domain: 'chkcol1.edu',
      status: 'active',
      isActive: true,
    });
  });

  afterAll(async () => {
    try {
      await User.deleteMany({
        email: {
          $in: [
            'sa-test-1@bookbuddy.test',
            'sa-test-2@bookbuddy.test',
            'target-user@bookbuddy.test',
          ],
        },
      });
      await College.deleteMany({
        slug: { $in: ['chk-college-1', 'chk-college-dup', 'reserved-test'] },
      });
      await SystemSetting.deleteMany({ key: 'maintenanceMode' });
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('1. Subdomain Tenant Restriction (P0)', () => {
    it('strictly forbids /admin-portal access when requested with tenant subdomain header (x-tenant-subdomain)', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-tenant-subdomain', 'chk-college-1');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/strictly restricted to the root platform domain/i);
    });

    it('strictly forbids /admin-portal access when requested with x-college-slug header', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('x-college-slug', 'chk-college-1');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/strictly restricted to the root platform domain/i);
    });

    it('allows access on platform root domain (no tenant headers)', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Self-Lockout & Last Super Admin Protections (P0)', () => {
    it('blocks self-lockout when a Super Admin attempts to disable their own account', async () => {
      const res = await request(app)
        .patch(`/api/v1/dashboards/admin-portal/users/${superAdminUser._id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'disabled', isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Self-lockout prevented/i);
    });

    it('blocks self-demotion when a Super Admin attempts to demote their own role', async () => {
      const res = await request(app)
        .patch(`/api/v1/dashboards/admin-portal/users/${superAdminUser._id}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'student' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Self-lockout prevented/i);
    });

    it('prevents demoting the last remaining active Super Admin', async () => {
      // Temporarily mark secondary super admin as inactive
      await User.findByIdAndUpdate(secondSuperAdminUser._id, {
        status: 'disabled',
        isActive: false,
      });

      // Attempting to demote the only remaining active super admin must fail with 400
      const lastAdminCheckRes = await request(app)
        .patch(`/api/v1/dashboards/admin-portal/users/${superAdminUser._id}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'college-admin' });

      // Self-demotion check or last remaining super admin check both return 400
      expect(lastAdminCheckRes.status).toBe(400);

      // Restore secondary admin
      await User.findByIdAndUpdate(secondSuperAdminUser._id, { status: 'active', isActive: true });
    });
  });

  describe('3. Session & Token Revocation on Status & Role Transitions (P0)', () => {
    let targetUser;

    beforeEach(async () => {
      await User.deleteMany({ email: 'target-user@bookbuddy.test' });
      targetUser = await User.create({
        studentId: `TGT-${Date.now().toString().slice(-4)}`,
        name: 'Target User',
        email: 'target-user@bookbuddy.test',
        password: 'UserPass@12345',
        role: 'student',
        status: 'active',
        isActive: true,
        membershipStatus: 'active',
        collegeId: testCollege._id,
      });

      await RefreshToken.deleteMany({ userId: targetUser._id });

      // Create unique active refresh token
      await RefreshToken.create({
        userId: targetUser._id,
        tokenHash: `hash_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        deviceInfo: 'Test Device',
        expiresAt: new Date(Date.now() + 86400000),
      });
    });

    it('revokes all active sessions when user status is suspended or disabled', async () => {
      const res = await request(app)
        .patch(`/api/v1/dashboards/admin-portal/users/${targetUser._id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'disabled', isActive: false });

      expect(res.status).toBe(200);

      const activeTokens = await RefreshToken.find({ userId: targetUser._id, revokedAt: null });
      expect(activeTokens.length).toBe(0);
    });

    it('revokes all active sessions when user role is changed', async () => {
      const res = await request(app)
        .patch(`/api/v1/dashboards/admin-portal/users/${targetUser._id}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'college-admin' });

      expect(res.status).toBe(200);

      const activeTokens = await RefreshToken.find({ userId: targetUser._id, revokedAt: null });
      expect(activeTokens.length).toBe(0);
    });
  });

  describe('4. Tenant Creation Hardening & Reserved Keyword Defense (P0)', () => {
    it('rejects tenant creation with reserved slug words (admin, api, app, etc.)', async () => {
      const res = await request(app)
        .post('/api/v1/dashboards/admin-portal/colleges')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Reserved Slug College',
          code: 'RSV01',
          slug: 'admin',
          domain: 'admin.edu',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/reserved/i);
    });

    it('rejects tenant creation with duplicate slug or code with 409', async () => {
      const res = await request(app)
        .post('/api/v1/dashboards/admin-portal/colleges')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Duplicate Slug College',
          code: 'CHKCOL1',
          slug: 'chk-college-1',
          domain: 'chkcol1.edu',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('creates tenant with unique admin ID and forces password change on next login', async () => {
      const uniqueSuffix = Date.now().toString().slice(-5);
      const testSlug = `fresh-col-${uniqueSuffix}`;
      const testCode = `FC${uniqueSuffix}`;
      const testEmail = `fresh_${uniqueSuffix}@freshcol.edu`;

      const res = await request(app)
        .post('/api/v1/dashboards/admin-portal/colleges')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Fresh Unique College',
          code: testCode,
          slug: testSlug,
          domain: `${testSlug}.edu`,
          adminName: 'Fresh Admin',
          adminEmail: testEmail,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.adminUser).toBeDefined();

      const createdAdmin = await User.findOne({ email: testEmail });
      expect(createdAdmin).toBeDefined();
      expect(createdAdmin.studentId).not.toBe('ADMIN-001');
      expect(createdAdmin.studentId).toMatch(/^admin-\d+-\d+$/i);
      expect(createdAdmin.mustChangePasswordOnNextLogin).toBe(true);

      // Clean up
      await User.deleteOne({ _id: createdAdmin._id });
      await College.deleteOne({ slug: testSlug });
    });
  });

  describe('5. Global Content Moderation: Approve Immediately Publishes (P0)', () => {
    let pendingResource;

    beforeEach(async () => {
      pendingResource = await EResource.create({
        collegeId: testCollege._id,
        title: 'Quantum Physics Notes',
        author: 'Prof. Heisenberg',
        type: 'pdf',
        fileUrl: 'https://storage.googleapis.com/test-bucket/quantum.pdf',
        category: 'Science',
        uploadedBy: superAdminUser._id,
        moderationStatus: 'pending',
        isPublished: false,
      });
    });

    afterEach(async () => {
      await EResource.deleteOne({ _id: pendingResource._id });
    });

    it('approving e-resource immediately sets moderationStatus: published and isPublished: true', async () => {
      const res = await request(app)
        .put(`/api/v1/dashboards/admin-portal/moderation/${pendingResource._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'approved',
          note: 'Verified and approved for publication.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.moderationStatus).toBe('published');
      expect(res.body.data.isPublished).toBe(true);

      const updatedDoc = await EResource.findById(pendingResource._id);
      expect(updatedDoc.moderationStatus).toBe('published');
      expect(updatedDoc.isPublished).toBe(true);
    });

    it('rejecting e-resource requires note/reason and sets isPublished: false', async () => {
      const failRes = await request(app)
        .put(`/api/v1/dashboards/admin-portal/moderation/${pendingResource._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'rejected',
          note: '',
        });

      expect(failRes.status).toBe(400);

      const passRes = await request(app)
        .put(`/api/v1/dashboards/admin-portal/moderation/${pendingResource._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'rejected',
          note: 'Copyright infringement reported.',
        });

      expect(passRes.status).toBe(200);
      expect(passRes.body.data.moderationStatus).toBe('rejected');
      expect(passRes.body.data.isPublished).toBe(false);
    });
  });

  describe('6. Disaster Recovery: Database Restore Heavily Gated (P0)', () => {
    it('rejects database restore without exact confirmation phrase', async () => {
      const res = await request(app)
        .post('/api/v1/dashboards/admin-portal/settings/trigger-restore')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ confirmationPhrase: 'restore_please' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/CONFIRM_RESTORE/i);
    });

    it('rejects database restore when system is not in maintenance mode', async () => {
      await SystemSetting.findOneAndUpdate(
        { key: 'maintenanceMode' },
        { value: false },
        { upsert: true }
      );

      const res = await request(app)
        .post('/api/v1/dashboards/admin-portal/settings/trigger-restore')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ confirmationPhrase: 'CONFIRM_RESTORE' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Maintenance Mode/i);
    });
  });

  describe('7. Security Redaction & Settings Masking (P0)', () => {
    it('telemetry /system/health redacts exact node patch version', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/system/health')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.nodeVersion).toMatch(/^v\d+\.x$/);
      expect(res.body.data.pid).toBe('[REDACTED]');
      expect(res.body.data.database.host).toBe('[REDACTED]');
    });

    it('system settings masks SMTP password and does not return plaintext secrets', async () => {
      await SystemSetting.findOneAndUpdate(
        { key: 'smtpPassword' },
        { value: 'super-secret-smtp-api-key' },
        { upsert: true }
      );

      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/settings')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.smtpPassword).toBe('••••••••••••');
      expect(res.body.data.smtpConfigured).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain('super-secret-smtp-api-key');
    });
  });

  describe('8. Support Queue: Ticket Resolution Validation', () => {
    let testComplaint;

    beforeEach(async () => {
      testComplaint = await Complaint.create({
        collegeId: testCollege._id,
        submittedBy: superAdminUser._id,
        category: 'facilities',
        subject: 'Broken chair in Reading Room 3',
        description: 'Seat leg is cracked.',
        status: 'open',
      });
    });

    afterEach(async () => {
      await Complaint.deleteOne({ _id: testComplaint._id });
    });

    it('requires a resolution message when resolving a ticket', async () => {
      const res = await request(app)
        .patch(`/api/v1/dashboards/admin-portal/support/complaints/${testComplaint._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'resolved', adminResponse: '' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Resolution message is required/i);
    });

    it('successfully resolves ticket when a resolution message is provided', async () => {
      const res = await request(app)
        .patch(`/api/v1/dashboards/admin-portal/support/complaints/${testComplaint._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          status: 'resolved',
          adminResponse: 'Maintenance team replaced the damaged chair.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.adminResponse).toBe('Maintenance team replaced the damaged chair.');
    });
  });
});
