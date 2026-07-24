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
  let adminB;
  let superAdmin;
  let tokenAdminA;
  let tokenAdminB;
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

    adminB = await User.create({
      studentId: 'ADM-B1',
      name: 'Admin Beta',
      email: 'admin@beta.edu',
      password: 'Password123!',
      role: 'college-admin',
      collegeId: collegeB._id,
      isEmailVerified: true,
    });
    tokenAdminB = generateTokenPair(adminB).accessToken;

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
    await mongoose.connection.close();
  });

  describe('BUILD 1: Service Catalog & Feature Resolution', () => {
    it('should list available active services in catalog', async () => {
      const res = await request(app).get('/api/services/available');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('should correctly resolve transitive dependencies (e.g. gamification -> catalog_management)', async () => {
      // Update selectedServices to ['gamification']
      const patchRes = await request(app)
        .patch(`/api/services/college/${collegeA._id}/features`)
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
        .patch(`/api/services/college/${collegeB._id}/features`)
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
        .get('/api/lab/seats')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not licensed or enabled');
    });

    it('should allow request when feature is enabled for tenant', async () => {
      // Enable facilities_booking for College A
      await request(app)
        .patch(`/api/services/college/${collegeA._id}/features`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ selectedServices: ['facilities_booking'] });

      const res = await request(app)
        .get('/api/lab/seats')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow Super Admin to bypass feature flag restrictions', async () => {
      const res = await request(app)
        .get('/api/lab/seats')
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
        .post(`/api/college/${collegeA._id}/students/bulk-upload`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .attach('file', txtPath);

      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid file format');
    });

    it('should reject cross-tenant upload requests with 403', async () => {
      // Admin A tries to upload to College B
      const res = await request(app)
        .post(`/api/college/${collegeB._id}/students/bulk-upload`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .attach('file', testCsvPath);

      expect(res.status).toBe(403);
    });

    it('should accept valid upload, return 202 Accepted with jobId, and process records asynchronously', async () => {
      const uploadRes = await request(app)
        .post(`/api/college/${collegeA._id}/students/bulk-upload`)
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
          .get(`/api/college/${collegeA._id}/students/upload/${jobId}`)
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
        .get(`/api/college/${collegeA._id}/students/upload/${jobId}/errors`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(reportRes.status).toBe(200);
      expect(reportRes.header['content-type']).toContain('text/csv');
      expect(reportRes.text).toContain('Invalid email address format');
    });
  });
});
