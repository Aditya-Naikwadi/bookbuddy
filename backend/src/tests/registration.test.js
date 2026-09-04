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
    await mongoose.connection.close();
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
      expect(createdUser.studentId).toBe('STU999');
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
