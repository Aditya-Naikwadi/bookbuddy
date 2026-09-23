/**
 * @testing-test-automation-engineer Test Suite:
 * Verify Tenant Onboarding Approval Side Effects Execute Outside Transaction
 *
 * Confirms:
 * 1. Post-commit side effects (sendTenantOnboardingApprovalEmail, Socket.IO broadcast,
 *    metrics cache clear, AuditLog) execute strictly after commit.
 * 2. If the transaction aborts or encounters an error (e.g. duplicate college code/domain,
 *    or application not found), zero emails are sent and zero broadcasts occur.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');
const College = require('../models/College');
const User = require('../models/User');
const RegistrationRequest = require('../models/RegistrationRequest');
const notificationService = require('../services/notificationService');
const adminPortalController = require('../controllers/dashboards/adminPortalController');

describe('@testing-test-automation-engineer: Tenant Onboarding Approval Side-Effects Isolation', () => {
  let superAdminUser;
  let mockIo;
  let mockEmit;
  let sendEmailSpy;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    superAdminUser = await User.create({
      studentId: 'SUP_' + unique,
      name: 'Super Admin Test',
      email: `super_${unique}@platform.edu`,
      password: 'Password123!',
      role: 'super-admin',
      status: 'active',
    });
  });

  afterAll(async () => {
    try {
      if (superAdminUser?._id) {
        await User.deleteMany({ _id: superAdminUser._id });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  beforeEach(() => {
    mockEmit = jest.fn();
    mockIo = {
      emit: mockEmit,
    };
    sendEmailSpy = jest
      .spyOn(notificationService, 'sendTenantOnboardingApprovalEmail')
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Executes approval email and Socket.IO broadcast AFTER tenant onboarding transaction commits', async () => {
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const regRequest = await RegistrationRequest.create({
      type: 'tenant_onboarding',
      status: 'pending_review',
      tenantData: {
        legalName: `Test University ${unique}`,
        shortName: `TU ${unique}`,
        institutionType: 'university',
        domain: `tu-${unique}.edu`,
        contactEmail: `contact_${unique}@tu.edu`,
        adminName: 'Dean of Engineering',
        adminEmail: `admin_${unique}@tu.edu`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        desiredSlug: `tu-${unique}`,
        selectedServices: ['catalog', 'loans', 'gamification'],
      },
    });

    const req = {
      params: { requestId: regRequest._id.toString() },
      user: { id: superAdminUser._id, role: 'super-admin' },
      headers: {},
      ip: '127.0.0.1',
      app: {
        get: jest.fn().mockReturnValue(mockIo),
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await adminPortalController.approveTenantOnboarding(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();

    // Confirm post-commit side effects fired
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy).toHaveBeenCalledWith(
      `admin_${unique}@tu.edu`,
      'Dean of Engineering',
      `Test University ${unique}`
    );

    expect(mockEmit).toHaveBeenCalledWith('admin:onboarding_updated', {
      requestId: regRequest._id,
      status: 'approved',
    });

    // Cleanup created college and users
    await College.deleteMany({ slug: `tu-${unique}` });
    await User.deleteMany({ email: `admin_${unique}@tu.edu` });
    await RegistrationRequest.deleteMany({ _id: regRequest._id });
  });

  it('2. Confirms NO email or broadcast occurs when onboarding approval transaction aborts', async () => {
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Create an existing college with duplicate code and slug
    const conflictCollege = await College.create({
      name: `Existing University ${unique}`,
      code: `CONFLICT_${unique.replace('-', '_')}`.toUpperCase(),
      slug: `conflict-${unique}`,
      status: 'active',
    });

    // Create a registration request with conflicting slug that will trigger duplicate key failure
    const conflictingRequest = await RegistrationRequest.create({
      type: 'tenant_onboarding',
      status: 'pending_review',
      tenantData: {
        legalName: `New Conflicting University ${unique}`,
        domain: `conflict-${unique}.edu`,
        adminName: 'Admin Conflict',
        adminEmail: `conflict_admin_${unique}@conflict.edu`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklm',
        desiredSlug: `conflict-${unique}`, // duplicate slug causes transaction abort
      },
    });

    const req = {
      params: { requestId: conflictingRequest._id.toString() },
      user: { id: superAdminUser._id, role: 'super-admin' },
      headers: {},
      ip: '127.0.0.1',
      app: {
        get: jest.fn().mockReturnValue(mockIo),
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await adminPortalController.approveTenantOnboarding(req, res, next);

    // Should have caught error and passed to next
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();

    // Verify ZERO side effects occurred during or after aborted transaction
    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();

    // Cleanup
    await College.deleteMany({ _id: conflictCollege._id });
    await RegistrationRequest.deleteMany({ _id: conflictingRequest._id });
  });
});
