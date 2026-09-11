process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/bookbuddy_phase0_test';
process.env.JWT_SECRET = 'testjwtsecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretkey999';

jest.setTimeout(60000);

const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const UploadJob = require('../models/UploadJob');
const UploadAuditLog = require('../models/UploadAuditLog');
const { generateTokenPair } = require('../utils/token');

describe('Phase 0: College Self-Service Onboarding & Security Foundation Tests', () => {
  let college;
  let collegeAdmin;
  let adminToken;
  let testCsvPath;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    try {
      await User.collection.dropIndexes();
      await College.collection.dropIndexes();
    } catch {
      // ignore
    }
    await User.syncIndexes();
    await College.syncIndexes();
  });

  beforeEach(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await UploadJob.deleteMany({});
    await UploadAuditLog.deleteMany({});

    college = await College.create({
      name: 'Pacific Coast University',
      code: 'PCU',
      slug: 'pacific-coast',
      domain: 'pacific.edu',
      status: 'active',
      isActive: true,
    });

    collegeAdmin = await User.create({
      studentId: 'ADM-001',
      name: 'Dean Smith',
      email: 'admin@pacific.edu',
      password: 'SecurePassword123!',
      role: 'college-admin',
      collegeId: college._id,
      isEmailVerified: true,
      status: 'active',
    });

    adminToken = generateTokenPair(collegeAdmin).accessToken;
  });

  afterEach(() => {
    if (testCsvPath && fs.existsSync(testCsvPath)) {
      fs.unlinkSync(testCsvPath);
    }
  });

  afterAll(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await UploadJob.deleteMany({});
    await UploadAuditLog.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('Item 1: College Slug Validation, Reserved Words & Immutability', () => {
    it('should reject reserved slugs during college creation', async () => {
      let threw = false;
      try {
        await College.create({
          name: 'Admin College',
          code: 'ADM-COL',
          slug: 'admin',
        });
      } catch (err) {
        threw = true;
        expect(err.message).toMatch(/reserved system keyword/i);
      }
      expect(threw).toBe(true);

      threw = false;
      try {
        await College.create({
          name: 'Super Admin College',
          code: 'SAC-COL',
          slug: 'superadmin',
        });
      } catch (err) {
        threw = true;
        expect(err.message).toMatch(/reserved system keyword/i);
      }
      expect(threw).toBe(true);
    });

    it('should reject invalid slug formats (length < 3, double hyphens, invalid characters)', async () => {
      let threw = false;
      try {
        await College.create({
          name: 'Short',
          code: 'SH',
          slug: 'ab',
        });
      } catch (err) {
        threw = true;
        expect(err.message).toMatch(/between 3 and 40 characters/i);
      }
      expect(threw).toBe(true);

      threw = false;
      try {
        await College.create({
          name: 'Invalid Chars',
          code: 'INV',
          slug: 'pacific--coast',
        });
      } catch (err) {
        threw = true;
        expect(err.message).toMatch(/lowercase letters, numbers, and hyphens/i);
      }
      expect(threw).toBe(true);
    });

    it('should check slug availability endpoint against reserved words, invalid formats, and collisions', async () => {
      // Reserved word check
      const resReserved = await request(app).get('/api/v1/colleges/slug-check?slug=portal');
      expect(resReserved.status).toBe(200);
      expect(resReserved.body.available).toBe(false);
      expect(resReserved.body.reason).toBe('reserved');

      // Invalid format check
      const resInvalid = await request(app).get('/api/v1/colleges/slug-check?slug=invalid--format');
      expect(resInvalid.status).toBe(200);
      expect(resInvalid.body.available).toBe(false);
      expect(resInvalid.body.reason).toBe('invalid_format');

      // Already taken check
      const resTaken = await request(app).get('/api/v1/colleges/slug-check?slug=pacific-coast');
      expect(resTaken.status).toBe(200);
      expect(resTaken.body.available).toBe(false);
      expect(resTaken.body.reason).toBe('taken');
      expect(resTaken.body.suggestedSlug).toBeDefined();

      // Clean available slug check
      const resClean = await request(app).get('/api/v1/colleges/slug-check?slug=stanford-tech');
      expect(resClean.status).toBe(200);
      expect(resClean.body.available).toBe(true);
    });

    it('should prevent mutating an established slug via document.save()', async () => {
      const existingCollege = await College.findById(college._id);
      expect(existingCollege.slug).toBe('pacific-coast');

      existingCollege.slug = 'new-mutated-slug';
      await expect(existingCollege.save()).rejects.toThrow(/immutable once established/i);
    });

    it('should prevent mutating an established slug via query update operators', async () => {
      await expect(
        College.findByIdAndUpdate(college._id, { $set: { slug: 'hacked-slug' } })
      ).rejects.toThrow(/slug is immutable/i);
    });
  });

  describe('Item 2: Secure Credential Generation & Missing Email Fallback', () => {
    it('should generate distinct random temp passwords, set mustChangePasswordOnNextLogin: true, and fallback to printed handouts for missing emails', async () => {
      testCsvPath = path.join(__dirname, 'students_missing_email.csv');
      const csvContent = [
        'name,email,studentId,department,phone',
        'Sarah Connor,sarah@pacific.edu,STU-201,Cybernetics,555-0100',
        'John Doe,,STU-202,History,555-0200', // Missing email, has phone
        'Kyle Reese,,STU-203,Military Science,', // Missing email, no phone (Printed Handout fallback)
      ].join('\n');
      fs.writeFileSync(testCsvPath, csvContent, 'utf8');

      const uploadRes = await request(app)
        .post(`/api/v1/college/${college._id}/students/bulk-upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', testCsvPath);

      expect(uploadRes.status).toBe(202);
      const jobId = uploadRes.body.data.jobId;

      // Wait for background worker processing
      let statusRes;
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 200));
        statusRes = await request(app)
          .get(`/api/v1/college/${college._id}/students/upload/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (statusRes.body.data.status === 'completed') break;
      }

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.status).toBe('completed');
      expect(statusRes.body.data.succeededRows).toBe(3);
      expect(statusRes.body.data.failedRows).toBe(0);
      expect(statusRes.body.data.deliverySummary.emailed).toBe(1);
      expect(statusRes.body.data.deliverySummary.sms).toBe(1);
      expect(statusRes.body.data.deliverySummary.handout).toBe(1);

      // Verify users in DB
      const sarah = await User.findOne({ studentId: 'stu-201' }).select('+password');
      const john = await User.findOne({ studentId: 'stu-202' }).select('+password');
      const kyle = await User.findOne({ studentId: 'stu-203' }).select('+password');

      expect(sarah).not.toBeNull();
      expect(sarah.email).toBe('sarah@pacific.edu');
      expect(sarah.mustChangePasswordOnNextLogin).toBe(true);

      expect(john).not.toBeNull();
      expect(john.email).toBeUndefined();
      expect(john.mustChangePasswordOnNextLogin).toBe(true);

      expect(kyle).not.toBeNull();
      expect(kyle.email).toBeUndefined();
      expect(kyle.mustChangePasswordOnNextLogin).toBe(true);

      // Ensure passwords are not static or identical
      expect(sarah.password).not.toBe(john.password);
      expect(john.password).not.toBe(kyle.password);

      // Verify Printed Handouts export endpoint
      const handoutRes = await request(app)
        .get(`/api/v1/college/${college._id}/students/upload/${jobId}/handouts`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(handoutRes.status).toBe(200);
      expect(handoutRes.header['content-type']).toContain('text/csv');
      expect(handoutRes.text).toContain('STU-202');
      expect(handoutRes.text).toContain('STU-203');
      expect(handoutRes.text).toContain('Temporary Password');
    });
  });

  describe('Item 3: Re-Upload Upsert Logic & Versioned Upload Audit Log', () => {
    it('should update existing students without duplicating and preserve active student passwords', async () => {
      // Step 1: Initial upload with 2 students
      testCsvPath = path.join(__dirname, 'batch1.csv');
      const batch1Content = [
        'name,email,studentId,department',
        'Alice Green,alice@pacific.edu,STU-301,Mathematics',
        'Bob White,bob@pacific.edu,STU-302,Physics',
      ].join('\n');
      fs.writeFileSync(testCsvPath, batch1Content, 'utf8');

      const upload1 = await request(app)
        .post(`/api/v1/college/${college._id}/students/bulk-upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', testCsvPath);

      const job1Id = upload1.body.data.jobId;
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const s = await request(app)
          .get(`/api/v1/college/${college._id}/students/upload/${job1Id}`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (s.body.data.status === 'completed') break;
      }

      // Simulate Alice logging in, activating account, and setting a permanent password
      const alice = await User.findOne({ studentId: 'stu-301' });
      alice.status = 'active';
      alice.mustChangePasswordOnNextLogin = false;
      alice.password = 'AlicePermanentPass123!';
      await alice.save();
      const aliceSavedPass = (await User.findOne({ studentId: 'stu-301' }).select('+password'))
        .password;

      // Step 2: Re-upload batch where Alice has updated department, Bob is still invited, and Charlie is brand new
      const batch2Path = path.join(__dirname, 'batch2.csv');
      const batch2Content = [
        'name,email,studentId,department',
        'Alice Green-Updated,alice@pacific.edu,STU-301,Advanced Applied Mathematics',
        'Bob White,bob@pacific.edu,STU-302,Theoretical Physics',
        'Charlie Blue,charlie@pacific.edu,STU-303,Chemistry',
      ].join('\n');
      fs.writeFileSync(batch2Path, batch2Content, 'utf8');

      const upload2 = await request(app)
        .post(`/api/v1/college/${college._id}/students/bulk-upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', batch2Path);

      const job2Id = upload2.body.data.jobId;
      let status2;
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 200));
        status2 = await request(app)
          .get(`/api/v1/college/${college._id}/students/upload/${job2Id}`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (status2.body.data.status === 'completed') break;
      }

      if (fs.existsSync(batch2Path)) fs.unlinkSync(batch2Path);

      expect(status2.body.data.status).toBe('completed');
      expect(status2.body.data.succeededRows).toBe(3);
      expect(status2.body.data.updatedRows).toBe(2); // Alice & Bob
      expect(status2.body.data.insertedRows).toBe(1); // Charlie

      // Verify Alice: department updated, NOT duplicated, password PRESERVED
      const aliceCount = await User.countDocuments({
        collegeId: college._id,
        studentId: 'stu-301',
      });
      expect(aliceCount).toBe(1);

      const aliceRefreshed = await User.findOne({ studentId: 'stu-301' }).select('+password');
      expect(aliceRefreshed.name).toBe('Alice Green-Updated');
      expect(aliceRefreshed.department).toBe('Advanced Applied Mathematics');
      expect(aliceRefreshed.status).toBe('active');
      expect(aliceRefreshed.mustChangePasswordOnNextLogin).toBe(false);
      expect(aliceRefreshed.password).toBe(aliceSavedPass); // Permanent password intact!

      // Step 3: Verify Versioned Upload Audit Log
      const auditRes = await request(app)
        .get(`/api/v1/college/${college._id}/students/upload-audit-logs`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.success).toBe(true);
      expect(auditRes.body.data.length).toBe(2); // 2 upload versions

      const v2 = auditRes.body.data.find((l) => l.version === 2);
      const v1 = auditRes.body.data.find((l) => l.version === 1);

      expect(v1).toBeDefined();
      expect(v1.version).toBe(1);
      expect(v1.insertedRows).toBe(2);
      expect(v1.updatedRows).toBe(0);

      expect(v2).toBeDefined();
      expect(v2.version).toBe(2);
      expect(v2.insertedRows).toBe(1);
      expect(v2.updatedRows).toBe(2);

      // Verify specific version query
      const v2Detail = await request(app)
        .get(`/api/v1/college/${college._id}/students/upload-audit-logs/2`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(v2Detail.status).toBe(200);
      expect(v2Detail.body.data.version).toBe(2);
      expect(v2Detail.body.data.jobId).toBe(job2Id);
    });
  });
});
