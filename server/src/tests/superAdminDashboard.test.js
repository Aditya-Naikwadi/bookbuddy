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
        action: 'user.password_reset',
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
      expect(res.body.message).toContain('Invalid user status');
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
