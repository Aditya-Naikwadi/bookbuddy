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
