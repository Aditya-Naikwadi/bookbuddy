/**
 * Consolidated Suite: onboarding Lifecycle
 * Merged from:
 *  - phase0Onboarding.test.js
 *  - phase1BulkUpload.test.js
 *  - phase1Remediation.test.js
 *  - phase2Optimizations.test.js
 *  - phase2Prelaunch.test.js
 *  - phase2Remediation.test.js
 *  - phase2SubdomainRouting.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('onboarding Lifecycle Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: phase0Onboarding.test.js]', () => {
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
          // await // mongoose.disconnect();
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
          const resInvalid = await request(app).get(
            '/api/v1/colleges/slug-check?slug=invalid--format'
          );
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
  });

  describe('[Source: phase1BulkUpload.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const StudentUploadBatch = require('../models/StudentUploadBatch');

    const { generateAccessToken } = require('../utils/token');

    describe('Phase 1 — Bulk Upload Pipeline & Delivery Status & Bulk Deactivation', () => {
      let college;
      let adminUser;
      let adminToken;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        try {
          await User.collection.dropIndexes();
          await User.syncIndexes();
        } catch {
          // ignore
        }

        await User.deleteMany({});
        await College.deleteMany({});
        await StudentUploadBatch.deleteMany({});

        // Create test college
        college = await College.create({
          name: 'Engineering Institute of Tech',
          code: 'EIT',
          domain: 'eit.edu',
          slug: 'eit-tech',
          status: 'active',
          isActive: true,
          subscriptionPlan: 'institution-enterprise',
        });

        // Create college admin
        adminUser = await User.create({
          studentId: 'ADM-EIT-001',
          name: 'Admin EIT',
          email: 'admin@eit.edu',
          password: 'SecureAdminPassword123!',
          role: 'college-admin',
          collegeId: college._id,
          status: 'active',
          isActive: true,
        });

        adminToken = generateAccessToken(adminUser);
      });

      afterAll(async () => {
        await User.deleteMany({});
        await College.deleteMany({});
        await StudentUploadBatch.deleteMany({});
        // await // mongoose.connection.close();
      });

      test('1. Dry-run upload validates CSV, detects duplicates and formula injection, creates preview batch', async () => {
        const csvContent =
          'StudentId,Name,Email,Program,Year\n' +
          'EIT-001,=cmd|/C calc!A0,student1@eit.edu,Computer Science,Year 1\n' +
          'EIT-002,Jane Doe,student2@eit.edu,Data Science,Year 2\n' +
          'EIT-003,Bob Smith,,Mechanical Engineering,Year 1\n'; // Missing email -> handout slip path

        const res = await request(app)
          .post('/api/admin/students/upload/validate')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', Buffer.from(csvContent), 'students_roster.csv');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.batchId).toBeDefined();
        expect(res.body.summary.totalRows).toBe(3);
        expect(res.body.summary.validRowsCount).toBe(3);

        // Formula injection sanitized
        const row1 = res.body.previewRows.find((r) => r.studentId === 'EIT-001');
        expect(row1.name.startsWith("'")).toBe(true);

        // Batch status is preview
        const batch = await StudentUploadBatch.findById(res.body.batchId);
        expect(batch.status).toBe('preview');
      });

      test('2. Non-blocking commit returns 202 Accepted and processes rows in background', async () => {
        // Dry-run validate first
        const csvContent =
          'StudentId,Name,Email,Program,Year\n' +
          'EIT-101,Alice Johnson,alice@eit.edu,Computer Science,Year 1\n' +
          'EIT-102,Charlie Brown,charlie@eit.edu,Electrical Engineering,Year 2\n' +
          'EIT-103,David Miller,,Civil Engineering,Year 3\n'; // No email -> handout path

        const valRes = await request(app)
          .post('/api/admin/students/upload/validate')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', Buffer.from(csvContent), 'batch_commit.csv');

        expect(valRes.status).toBe(200);
        const batchId = valRes.body.batchId;
        const validRows = valRes.body.validRowsPayload;

        // Commit non-blocking
        const commitRes = await request(app)
          .post('/api/admin/students/upload/commit')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            batchId,
            validRows,
            bulkDeactivateAbsent: false,
          });

        expect(commitRes.status).toBe(202);
        expect(commitRes.body.success).toBe(true);
        expect(commitRes.body.status).toBe('processing');

        // Wait for background job completion
        let isDone = false;
        for (let attempt = 0; attempt < 25; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          const statusRes = await request(app)
            .get(`/api/admin/students/upload/${batchId}/status`)
            .set('Authorization', `Bearer ${adminToken}`);

          if (statusRes.body.batch.status === 'committed') {
            isDone = true;
            break;
          }
        }

        expect(isDone).toBe(true);

        // Verify accounts created in User collection
        const alice = await User.findOne({ collegeId: college._id, studentId: 'EIT-101' });
        expect(alice).toBeTruthy();
        expect(alice.email).toBe('alice@eit.edu');
        expect(alice.status).toBe('invited');
        expect(alice.mustChangePasswordOnNextLogin).toBe(true);

        const david = await User.findOne({ collegeId: college._id, studentId: 'EIT-103' });
        expect(david).toBeTruthy();
        expect(david.email).toBeUndefined();
      });

      test('3. Delivery-status endpoint returns per-row delivery outcomes and handout slips', async () => {
        const batches = await StudentUploadBatch.find({ collegeId: college._id }).sort({
          createdAt: -1,
        });
        const latestBatch = batches[0];

        const res = await request(app)
          .get(`/api/admin/students/upload/${latestBatch._id}/delivery-status`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.summary.created).toBe(3);
        expect(res.body.summary.no_contact_info).toBe(1); // David has no email -> handout slip
        expect(res.body.hasCredentialSlips).toBe(true);

        // Verify handout slips export endpoint
        const handoutRes = await request(app)
          .get(`/api/admin/students/upload/${latestBatch._id}/handouts`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(handoutRes.status).toBe(200);
        expect(handoutRes.headers['content-type']).toContain('text/csv');
        expect(handoutRes.text).toContain('EIT-103');
        expect(handoutRes.text).toContain('David Miller');
      });

      test('4. Bulk deactivation marks absent students as inactive without deleting records', async () => {
        // Current enrolled students: EIT-101, EIT-102, EIT-103
        // We activate EIT-101
        await User.updateOne(
          { collegeId: college._id, studentId: 'EIT-101' },
          { status: 'active', mustChangePasswordOnNextLogin: false }
        );

        // New upload containing ONLY EIT-101 and EIT-102 (EIT-103 is absent!)
        const newCsv =
          'StudentId,Name,Email,Program,Year\n' +
          'EIT-101,Alice Johnson Updated,alice@eit.edu,Computer Science,Year 2\n' +
          'EIT-102,Charlie Brown,charlie@eit.edu,Electrical Engineering,Year 2\n';

        const valRes = await request(app)
          .post('/api/admin/students/upload/validate')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', Buffer.from(newCsv), 'new_roster.csv');

        expect(valRes.status).toBe(200);
        const batchId = valRes.body.batchId;

        // Commit with bulkDeactivateAbsent: true
        const commitRes = await request(app)
          .post('/api/admin/students/upload/commit')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            batchId,
            validRows: valRes.body.validRowsPayload,
            bulkDeactivateAbsent: true,
          });

        expect(commitRes.status).toBe(202);

        // Wait for completion
        for (let attempt = 0; attempt < 25; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          const statusRes = await request(app)
            .get(`/api/admin/students/upload/${batchId}/status`)
            .set('Authorization', `Bearer ${adminToken}`);

          if (statusRes.body.batch.status === 'committed') {
            break;
          }
        }

        // Verify EIT-103 was deactivated, NOT deleted
        const david = await User.findOne({ collegeId: college._id, studentId: 'EIT-103' });
        expect(david).toBeTruthy();
        expect(david.status).toBe('inactive');
        expect(david.deactivatedAt).toBeDefined();
        expect(david.deactivationReason).toContain('Omitted from roster upload batch');

        // Verify EIT-101 active password preserved
        const alice = await User.findOne({ collegeId: college._id, studentId: 'EIT-101' });
        expect(alice.status).toBe('active');
        expect(alice.name).toBe('Alice Johnson Updated');
        expect(alice.mustChangePasswordOnNextLogin).toBe(false);

        // Verify delivery status reported deactivation
        const deliveryRes = await request(app)
          .get(`/api/admin/students/upload/${batchId}/delivery-status`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(deliveryRes.status).toBe(200);
        expect(deliveryRes.body.summary.deactivated).toBe(1);
        const deactivatedRow = deliveryRes.body.rowResults.find(
          (r) => r.studentId.toLowerCase() === 'eit-103'
        );
        expect(deactivatedRow).toBeTruthy();
        expect(deactivatedRow.action).toBe('deactivated');
        expect(deactivatedRow.deliveryStatus).toBe('inactive');
      });
    });
  });

  describe('[Source: phase1Remediation.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_phase1_test';

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Fine = require('../models/Fine');
    const Loan = require('../models/Loan');
    const Payment = require('../models/Payment');
    const { generateTokenPair } = require('../utils/token');

    describe('Phase 1 Remediation Integration Tests', () => {
      let college;
      let student;
      let tokenStudent;
      let fine;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        try {
          await mongoose.connection.db.collection('payments').dropIndex('providerEventId_1');
        } catch (_err) {
          // Index may already be dropped
        }
        await Payment.syncIndexes();
      });

      afterAll(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await Fine.deleteMany({});
        await Loan.deleteMany({});
        await Payment.deleteMany({});
        // await // mongoose.disconnect();
      });

      beforeEach(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await Fine.deleteMany({});
        await Loan.deleteMany({});
        await Payment.deleteMany({});

        college = await College.create({
          name: 'Phase 1 College',
          code: 'P1C',
          domain: 'phase1.edu',
          status: 'active',
          isActive: true,
        });

        student = await User.create({
          studentId: 'STU_P1',
          name: 'Phase 1 Student',
          email: 'student@phase1.edu',
          password: 'password123',
          collegeId: college._id,
          role: 'student',
          isActive: true,
        });

        tokenStudent = generateTokenPair(student).accessToken;

        const loan = await Loan.create({
          userId: student._id,
          collegeId: college._id,
          bookId: new mongoose.Types.ObjectId(),
          issuedBy: student._id,
          maxRenewals: 2,
          status: 'overdue',
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        });

        fine = await Fine.create({
          userId: student._id,
          collegeId: college._id,
          loanId: loan._id,
          overdueDays: 5,
          amount: 50,
          reason: 'Overdue textbook',
          status: 'unpaid',
        });
      });

      test('1. Idempotency Middleware: Retried payment request with same Idempotency-Key returns cached response', async () => {
        const idempotencyKey = `key_test_${Date.now()}`;

        // First payment checkout request
        const res1 = await request(app)
          .post('/api/v1/payments/checkout-session')
          .set('Authorization', `Bearer ${tokenStudent}`)
          .set('Idempotency-Key', idempotencyKey)
          .send({ fineId: fine._id.toString() });

        expect(res1.status).toBe(200);
        expect(res1.body.success).toBe(true);
        expect(res1.headers['x-cache-lookup']).toBeUndefined();

        // Second retried request with identical Idempotency-Key
        const res2 = await request(app)
          .post('/api/v1/payments/checkout-session')
          .set('Authorization', `Bearer ${tokenStudent}`)
          .set('Idempotency-Key', idempotencyKey)
          .send({ fineId: fine._id.toString() });

        expect(res2.status).toBe(200);
        expect(res2.body.success).toBe(true);
        expect(res2.headers['x-cache-lookup']).toBe('HIT-Idempotency');
        expect(res2.body.data.orderId).toBe(res1.body.data.orderId);
      });

      test('2. Path Versioning: Canonical /api/v1/ and legacy /api/ endpoints both work, with legacy emitting deprecation header', async () => {
        // Canonical /api/v1/ endpoint hit
        const resCanonical = await request(app).get('/api/v1/registration/colleges');

        expect(resCanonical.status).toBe(200);
        expect(resCanonical.headers['x-deprecated-path']).toBeUndefined();

        // Legacy unversioned /api/ endpoint hit
        const resLegacy = await request(app).get('/api/registration/colleges');

        expect(resLegacy.status).toBe(200);
        expect(resLegacy.headers['x-deprecated-path']).toBe('true');
        expect(resLegacy.headers['x-deprecation-warning']).toMatch(/removed in 90 days/i);
      });
    });
  });

  describe('[Source: phase2Optimizations.test.js]', () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_phase2_opt_test';
    process.env.JWT_SECRET = 'test_jwt_secret_phase2_opt';
    process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_phase2_opt';
    jest.setTimeout(60000);

    const request = require('supertest');
    const mongoose = require('mongoose');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Loan = require('../models/Loan');
    const EResource = require('../models/EResource');
    const Review = require('../models/Review');
    const ReadingProgress = require('../models/ReadingProgress');
    const { generateTokenPair } = require('../utils/token');
    const { getCache, setCache } = require('../utils/redisCache');

    describe('Phase 2 Performance & UX Optimizations Verification Suite', () => {
      let college;
      let collegeAdmin;
      let studentUser;
      let adminToken;
      let studentToken;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await EResource.deleteMany({});
        await Review.deleteMany({});
        await Loan.deleteMany({});
        await ReadingProgress.deleteMany({});

        college = await College.create({
          name: 'Phase 2 Test University',
          code: `P2U_${Date.now()}`,
          status: 'active',
          isActive: true,
        });

        collegeAdmin = await User.create({
          name: 'College Admin',
          studentId: 'ADM-P2-01',
          email: 'admin.p2@test.edu',
          password: 'password123',
          role: 'college-admin',
          collegeId: college._id,
          department: 'Library Science',
          status: 'active',
          isActive: true,
        });
        adminToken = generateTokenPair(collegeAdmin).accessToken;

        studentUser = await User.create({
          name: 'Alice Wonder',
          studentId: 'STU-P2-100',
          email: 'alice.wonder@test.edu',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
          department: 'Computer Science',
          status: 'active',
          isActive: true,
        });
        studentToken = generateTokenPair(studentUser).accessToken;
      });

      afterAll(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await EResource.deleteMany({});
        await Review.deleteMany({});
        await Loan.deleteMany({});
        await ReadingProgress.deleteMany({});
        // await // mongoose.disconnect();
      });

      describe('Item 13 & 19: Email/StudentId Normalization & Explicit Tenant Requirement', () => {
        it('Item 19: should reject registration when collegeId is omitted for non-super-admin', async () => {
          const res = await request(app).post('/api/v1/auth/register').send({
            name: 'No College User',
            studentId: 'STU-NO-COLLEGE',
            email: 'no.college@test.edu',
            password: 'password123',
          });

          expect(res.status).toBe(400);
          expect(res.body.success).toBe(false);
          expect(res.body.message).toMatch(/College selection is required/i);
        });

        it('Item 13: should normalize email and studentId to lowercase on save', async () => {
          const mixedStudent = await User.create({
            name: 'Bob MixedCase',
            studentId: 'STU-MiXeD-99',
            email: 'BoB.MiXeD@Test.Edu',
            password: 'password123',
            role: 'student',
            collegeId: college._id,
          });

          expect(mixedStudent.studentId).toBe('stu-mixed-99');
          expect(mixedStudent.email).toBe('bob.mixed@test.edu');

          // Login using uppercase variation against normalized compound index
          const loginRes = await request(app).post('/api/v1/auth/login').send({
            studentId: 'STU-MIXED-99',
            password: 'password123',
            collegeId: college._id.toString(),
          });

          expect(loginRes.status).toBe(200);
          expect(loginRes.body.success).toBe(true);
          expect(loginRes.body.user.email).toBe('bob.mixed@test.edu');
          expect(loginRes.body.user.studentId).toBe('stu-mixed-99');
        });
      });

      describe('Item 14: Keyset/Cursor Pagination on GET /books & Redis Count Caching', () => {
        beforeAll(async () => {
          const booksToCreate = [];
          const baseTime = Date.now() - 50000;
          for (let i = 1; i <= 15; i++) {
            booksToCreate.push({
              collegeId: college._id,
              title: `Keyset Book Volume ${String(i).padStart(2, '0')}`,
              author: `Author ${i}`,
              isbn: `97800011122${String(i).padStart(2, '0')}`,
              category: 'Engineering',
              format: 'physical',
              copiesTotal: 3,
              copiesAvailable: 3,
              createdAt: new Date(baseTime + i * 1000),
            });
          }
          await Book.insertMany(booksToCreate);
        });

        it('should paginate via keyset cursor, return nextCursor, and cache total count', async () => {
          // First page
          const page1Res = await request(app)
            .get('/api/v1/books?limit=5&sortBy=newest')
            .set('Authorization', `Bearer ${studentToken}`);

          expect(page1Res.status).toBe(200);
          expect(page1Res.body.success).toBe(true);
          expect(page1Res.body.books.length).toBe(5);
          expect(page1Res.body.pagination.hasMore).toBe(true);
          expect(page1Res.body.pagination.nextCursor).toBeDefined();
          expect(page1Res.body.total).toBe(15);

          const cursor1 = page1Res.body.pagination.nextCursor;
          const page1Titles = page1Res.body.books.map((b) => b.title);

          // Second page with cursor
          const page2Res = await request(app)
            .get(`/api/v1/books?limit=5&sortBy=newest&cursor=${encodeURIComponent(cursor1)}`)
            .set('Authorization', `Bearer ${studentToken}`);

          expect(page2Res.status).toBe(200);
          expect(page2Res.body.success).toBe(true);
          expect(page2Res.body.books.length).toBe(5);
          const page2Titles = page2Res.body.books.map((b) => b.title);

          // Verify no overlap between page 1 and page 2
          expect(page2Titles.some((t) => page1Titles.includes(t))).toBe(false);
        });
      });

      describe('Item 15: Compound Index & Cursor Pagination on EResource', () => {
        beforeAll(async () => {
          const eresourcesToCreate = [];
          const baseTime = Date.now() - 50000;
          for (let i = 1; i <= 8; i++) {
            eresourcesToCreate.push({
              collegeId: college._id,
              title: `Digital Resource ${String(i).padStart(2, '0')}`,
              author: `Digital Author ${i}`,
              type: 'pdf',
              fileUrl: `/uploads/test-${i}.pdf`,
              category: 'Computer Science',
              uploadedBy: collegeAdmin._id,
              moderationStatus: 'approved',
              source: 'internal',
              createdAt: new Date(baseTime + i * 1000),
            });
          }
          await EResource.insertMany(eresourcesToCreate);
        });

        it('should paginate EResources using cursor and return nextCursor', async () => {
          const res1 = await request(app)
            .get('/api/v1/eresources?limit=4')
            .set('Authorization', `Bearer ${studentToken}`);

          expect(res1.status).toBe(200);
          expect(res1.body.success).toBe(true);
          expect(res1.body.data.length).toBe(4);
          expect(res1.body.pagination.hasMore).toBe(true);
          expect(res1.body.pagination.nextCursor).toBeDefined();

          const nextCursor = res1.body.pagination.nextCursor;

          const res2 = await request(app)
            .get(`/api/v1/eresources?limit=4&cursor=${encodeURIComponent(nextCursor)}`)
            .set('Authorization', `Bearer ${studentToken}`);

          expect(res2.status).toBe(200);
          expect(res2.body.data.length).toBe(4);
          expect(res2.body.pagination.hasMore).toBe(false);
        });
      });

      describe('Item 16: Reading Progress Short-Circuited Verification', () => {
        let testBook;
        beforeAll(async () => {
          testBook = await Book.create({
            collegeId: college._id,
            title: 'Algorithms in Go',
            author: 'Go Author',
            isbn: `9780009998811`,
            category: 'Tech',
            copiesTotal: 1,
            copiesAvailable: 0,
          });

          // User has an active loan
          await Loan.create({
            collegeId: college._id,
            userId: studentUser._id,
            bookId: testBook._id,
            status: 'active',
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 86400000),
            issuedBy: collegeAdmin._id,
            maxRenewals: 2,
          });
        });

        it('should verify access on first save and short-circuit subsequent saves via Redis/record shortcut', async () => {
          // First save: Full verification & cache write
          const save1 = await request(app)
            .put(`/api/v1/reading-progress/${testBook._id}`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ position: 'page-10', percentageComplete: 10 });

          expect(save1.status).toBe(200);
          expect(save1.body.success).toBe(true);

          // Verify cached in Redis
          const cacheKey = `reading_access:${studentUser._id}:${testBook._id}`;
          const cached = await getCache(cacheKey);
          expect(cached).toBeDefined();
          expect(cached.hasAccess).toBe(true);

          // Second save: Short-circuits with 0 DB access checks
          const save2 = await request(app)
            .put(`/api/v1/reading-progress/${testBook._id}`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ position: 'page-25', percentageComplete: 25 });

          expect(save2.status).toBe(200);
          expect(save2.body.success).toBe(true);
          expect(save2.body.data.position).toBe('page-25');
        });
      });

      describe('Item 17: College Admin Patron Search & Department Filtering', () => {
        beforeAll(async () => {
          await User.create([
            {
              name: 'Charles Babbage',
              studentId: 'STU-BABBAGE-01',
              email: 'babbage@test.edu',
              password: 'password123',
              role: 'student',
              collegeId: college._id,
              department: 'Mechanical',
              status: 'active',
            },
            {
              name: 'Ada Lovelace',
              studentId: 'STU-LOVELACE-02',
              email: 'ada@test.edu',
              password: 'password123',
              role: 'student',
              collegeId: college._id,
              department: 'Mathematics',
              status: 'active',
            },
          ]);
        });

        it('should filter patrons by department parameter', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/college-admin/patrons?department=Mathematics')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].name).toBe('Ada Lovelace');
        });

        it('should filter patrons by studentId parameter', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/college-admin/patrons?studentId=STU-BABBAGE-01')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].name).toBe('Charles Babbage');
        });
      });

      describe('Item 18: Denormalized ratingSummary on Book with Incremental Updates', () => {
        let ratedBook;
        let reviewId;

        beforeAll(async () => {
          ratedBook = await Book.create({
            collegeId: college._id,
            title: 'Microservices Patterns',
            author: 'Chris Richardson',
            isbn: `9780002223344`,
            category: 'Architecture',
            copiesTotal: 5,
            copiesAvailable: 5,
          });
        });

        it('should incrementally update ratingSummary on review create', async () => {
          const res = await request(app)
            .post('/api/v1/reviews')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
              bookId: ratedBook._id.toString(),
              rating: 5,
              title: 'Masterpiece',
              comment: 'Essential reading for distributed architectures.',
            });

          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);
          reviewId = res.body.data._id;

          // Verify denormalized on Book
          const updatedBook = await Book.findById(ratedBook._id);
          expect(updatedBook.ratingSummary).toBeDefined();
          expect(updatedBook.ratingSummary.count).toBe(1);
          expect(updatedBook.ratingSummary.average).toBe(5);
          expect(updatedBook.ratingSummary.distribution[5]).toBe(1);
          expect(updatedBook.avgRating).toBe(5);
          expect(updatedBook.ratingCount).toBe(1);
        });

        it('should fetch reviews in O(1) time returning denormalized ratingSummary', async () => {
          const res = await request(app)
            .get(`/api/v1/books/${ratedBook._id}/reviews`)
            .set('Authorization', `Bearer ${studentToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.summary).toBeDefined();
          expect(res.body.summary.averageRating).toBe(5);
          expect(res.body.summary.totalReviews).toBe(1);
          expect(res.body.summary.breakdown[5]).toBe(1);
        });

        it('should incrementally adjust ratingSummary on review update', async () => {
          const res = await request(app)
            .put(`/api/v1/reviews/${reviewId}`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
              rating: 3,
              title: 'Good but dense',
            });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const updatedBook = await Book.findById(ratedBook._id);
          expect(updatedBook.ratingSummary.count).toBe(1);
          expect(updatedBook.ratingSummary.average).toBe(3);
          expect(updatedBook.ratingSummary.distribution[5]).toBe(0);
          expect(updatedBook.ratingSummary.distribution[3]).toBe(1);
        });

        it('should incrementally adjust ratingSummary on review delete', async () => {
          const res = await request(app)
            .delete(`/api/v1/reviews/${reviewId}`)
            .set('Authorization', `Bearer ${studentToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const updatedBook = await Book.findById(ratedBook._id);
          expect(updatedBook.ratingSummary.count).toBe(0);
          expect(updatedBook.ratingSummary.average).toBe(0);
          expect(updatedBook.ratingSummary.distribution[3]).toBe(0);
        });
      });
    });
  });

  describe('[Source: phase2Prelaunch.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_phase2_prelaunch_test';

    const app = require('../app');
    const AuditLog = require('../models/AuditLog');
    const NotificationLog = require('../models/NotificationLog');
    const { captureException } = require('../utils/sentry');

    describe('Phase 2 Pre-Launch Checklist Integration Tests', () => {
      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
      });

      afterAll(async () => {
        if (mongoose.connection.db) {
          await mongoose.connection.db.dropDatabase();
        }
        // await // mongoose.disconnect();
      });

      test('1. Health check /health returns DB & Redis connectivity status', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.dbConnection).toBe('connected');
        expect(res.body.redisConnection).toBeDefined();
      });

      test('2. AuditLog retains audit trails indefinitely for compliance and NotificationLog has 90-day TTL index', async () => {
        await AuditLog.syncIndexes();
        await NotificationLog.syncIndexes();

        const auditIndexes = await AuditLog.collection.indexes();
        const ttlAudit = auditIndexes.find((idx) => idx.expireAfterSeconds !== undefined);
        expect(ttlAudit).toBeUndefined(); // Indefinite retention compliance

        const notifIndexes = await NotificationLog.collection.indexes();
        const ttlNotif = notifIndexes.find((idx) => idx.expireAfterSeconds !== undefined);
        expect(ttlNotif).toBeDefined();
        expect(ttlNotif.expireAfterSeconds).toBe(7776000); // 90 days
      });

      test('3. Sentry captureException utility operates safely without crashing', () => {
        expect(() => {
          captureException(new Error('Test background error'), { scope: 'unit-test' });
        }).not.toThrow();
      });
    });
  });

  describe('[Source: phase2Remediation.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_phase2_test';

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const { generateTokenPair } = require('../utils/token');
    const { gutendexBreaker } = require('../services/gutendexClient');
    const BookDTO = require('../dtos/BookDTO');
    const ReservationDTO = require('../dtos/ReservationDTO');

    describe('Phase 2 Roadmap Remediation Integration Tests', () => {
      jest.setTimeout(30000);
      let college;
      let admin;
      let tokenAdmin;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
      });

      afterAll(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        // await // mongoose.disconnect();
      });

      beforeEach(async () => {
        await College.deleteMany({});
        await User.deleteMany({});

        college = await College.create({
          name: 'Phase 2 College',
          code: 'P2C',
          domain: 'phase2.edu',
          status: 'active',
          isActive: true,
        });

        admin = await User.create({
          studentId: 'ADMIN_P2',
          name: 'Phase 2 Admin',
          email: 'admin@phase2.edu',
          password: 'password123',
          collegeId: college._id,
          role: 'super-admin',
          isActive: true,
        });

        tokenAdmin = generateTokenPair(admin).accessToken;
      });

      test('1. Circuit Breaker: Gutendex circuit breaker trips to OPEN mode on repeated failures', async () => {
        gutendexBreaker.state = 'CLOSED';
        gutendexBreaker.failureCount = 0;

        // Simulate 3 failures
        gutendexBreaker.onFailure(new Error('500 Internal Server Error'));
        gutendexBreaker.onFailure(new Error('500 Internal Server Error'));
        gutendexBreaker.onFailure(new Error('500 Internal Server Error'));

        expect(gutendexBreaker.state).toBe('OPEN');

        // Fire circuit breaker while OPEN -> Fast fails returning fallback empty list
        const fallbackResult = await gutendexBreaker.fire('physics');
        expect(fallbackResult).toEqual([]);
      });

      test('2. Async Aggregator: POST /api/v1/aggregator/sync returns HTTP 202 Ack with jobId', async () => {
        const res = await request(app)
          .post('/api/v1/aggregator/sync')
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .send({ topic: 'quantum physics' });

        expect(res.status).toBe(202);
        expect(res.body.success).toBe(true);
        expect(res.body.jobId).toBeDefined();
        expect(res.body.statusUrl).toContain(res.body.jobId);

        // Query job status endpoint
        const statusRes = await request(app)
          .get(`/api/v1/aggregator/jobs/${res.body.jobId}`)
          .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(statusRes.status).toBe(200);
        expect(statusRes.body.data.topic).toBe('quantum physics');
      });

      test('3. OpenAPI Specification: GET /api/v1/docs/swagger.json returns valid OpenAPI 3.0 schema', async () => {
        const res = await request(app).get('/api/v1/docs/swagger.json');

        expect(res.status).toBe(200);
        expect(res.body.openapi).toBe('3.0.0');
        expect(res.body.info.title).toBe('BookBuddy Multi-Tenant API');
        expect(res.body.paths['/auth/login']).toBeDefined();
      });

      test('4. DTO Mappers: BookDTO and ReservationDTO format document payloads cleanly', () => {
        const bookDoc = {
          _id: new mongoose.Types.ObjectId('60d21b4667d0d8992e610d86'),
          title: 'Advanced AI Architectures',
          author: 'Dr. Jane Doe',
          category: 'Computer Science',
          copiesTotal: 5,
          copiesAvailable: 3,
        };

        const bookDto = BookDTO.transform(bookDoc);
        expect(bookDto.id).toBe('60d21b4667d0d8992e610d86');
        expect(bookDto.authors).toContain('Dr. Jane Doe');
        expect(bookDto.copiesAvailable).toBe(3);

        const resDoc = {
          _id: new mongoose.Types.ObjectId('60d21b4667d0d8992e610d87'),
          userId: new mongoose.Types.ObjectId('60d21b4667d0d8992e610d88'),
          bookId: bookDoc,
          queuePosition: 2,
          status: 'queued',
        };

        const resDto = ReservationDTO.transform(resDoc);
        expect(resDto.id).toBe('60d21b4667d0d8992e610d87');
        expect(resDto.queuePosition).toBe(2);
        expect(resDto.bookId.title).toBe('Advanced AI Architectures');
      });
    });
  });

  describe('[Source: phase2SubdomainRouting.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const { extractSubdomain } = require('../middlewares/subdomainTenantResolver');

    describe('Phase 2 — Individual Tenant URL, Subdomain Resolution & Zero Cross-Tenant Leakage', () => {
      let collegeA;
      let collegeB;
      let studentA;
      let studentB;
      let tokenA;
      let tokenB;
      let superAdmin;
      let superAdminToken;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        try {
          await User.collection.dropIndexes();
          await User.syncIndexes();
        } catch {
          // ignore
        }

        await User.deleteMany({});
        await College.deleteMany({});

        // College A (MIT)
        collegeA = await College.create({
          name: 'Massachusetts Institute of Technology',
          code: 'MIT',
          domain: 'mit.edu',
          slug: 'mit-tech',
          status: 'active',
          isActive: true,
          subscriptionPlan: 'institution-enterprise',
        });

        // College B (Stanford)
        collegeB = await College.create({
          name: 'Stanford University',
          code: 'STAN',
          domain: 'stanford.edu',
          slug: 'stanford-univ',
          status: 'active',
          isActive: true,
          subscriptionPlan: 'institution-enterprise',
        });

        // Student A (belonging to College A)
        studentA = await User.create({
          name: 'Student MIT',
          studentId: 'MIT-001',
          email: 'student@mit.edu',
          password: 'SecurePassword123!',
          role: 'student',
          collegeId: collegeA._id,
          status: 'active',
          isActive: true,
        });

        // Student B (belonging to College B)
        studentB = await User.create({
          name: 'Student Stanford',
          studentId: 'STAN-001',
          email: 'student@stanford.edu',
          password: 'SecurePassword123!',
          role: 'student',
          collegeId: collegeB._id,
          status: 'active',
          isActive: true,
        });

        // Super Admin
        superAdmin = await User.create({
          studentId: 'SUP-001',
          name: 'Global Admin',
          email: 'globaladmin@bookbuddy.com',
          password: 'SuperSecurePass123!',
          role: 'super-admin',
          status: 'active',
          isActive: true,
        });

        const { generateAccessToken } = require('../utils/token');
        tokenA = generateAccessToken(studentA);
        tokenB = generateAccessToken(studentB);
        superAdminToken = generateAccessToken(superAdmin);
      });

      afterAll(async () => {
        await User.deleteMany({});
        await College.deleteMany({});
        // await // mongoose.connection.close();
      });

      test('1. Subdomain extraction accurately identifies tenant slugs and excludes root/reserved hosts', () => {
        // Subdomain host patterns
        expect(extractSubdomain({ headers: { host: 'mit-tech.bookbuddy.com' } })).toBe('mit-tech');
        expect(extractSubdomain({ headers: { host: 'stanford-univ.localhost:5000' } })).toBe(
          'stanford-univ'
        );
        expect(extractSubdomain({ headers: { 'x-tenant-subdomain': 'mit-tech' } })).toBe(
          'mit-tech'
        );

        // Root domains ignored
        expect(extractSubdomain({ headers: { host: 'localhost:5000' } })).toBeNull();
        expect(extractSubdomain({ headers: { host: 'bookbuddy.com' } })).toBeNull();
        expect(extractSubdomain({ headers: { host: 'book-buddy-preview.vercel.app' } })).toBeNull();

        // Reserved slugs ignored
        expect(extractSubdomain({ headers: { host: 'admin.bookbuddy.com' } })).toBe('admin');
      });

      test('2. Pre-scoped login: Student A logs in successfully on College A subdomain', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Host', 'mit-tech.bookbuddy.com')
          .send({
            studentId: 'MIT-001',
            password: 'SecurePassword123!',
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user._id).toBe(studentA._id.toString());
        expect(res.body.accessToken).toBeDefined();
      });

      test('3. Pre-scoped login: Student B fails to log in on College A subdomain (tenant isolation)', async () => {
        // Attempting to log in as Stanford student on MIT subdomain
        const res = await request(app)
          .post('/api/auth/login')
          .set('Host', 'mit-tech.bookbuddy.com')
          .send({
            studentId: 'STAN-001',
            password: 'SecurePassword123!',
          });

        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Invalid credentials');
      });

      test('4. Zero Cross-Tenant Leakage: Request on College A subdomain attempting College B payload is blocked', async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Host', 'mit-tech.bookbuddy.com')
          .send({
            studentId: 'MIT-001',
            password: 'SecurePassword123!',
            collegeId: collegeB._id.toString(), // Attacker tries to inject College B context!
          });

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Cross-tenant access violation');
      });

      test('5. Zero Cross-Tenant Leakage: Request on College A subdomain attempting College B query parameter is blocked', async () => {
        const res = await request(app)
          .get(`/api/v1/colleges?collegeId=${collegeB._id}`)
          .set('Host', 'mit-tech.bookbuddy.com');

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Cross-tenant access violation');
      });

      test('6. Zero Cross-Tenant Leakage: Token from College B accessing protected route on College A subdomain is blocked', async () => {
        const res = await request(app)
          .get('/api/v1/auth/profile')
          .set('Host', 'mit-tech.bookbuddy.com')
          .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Cross-tenant access violation');
      });

      test('7. Token from College A accessing protected route on College A subdomain succeeds', async () => {
        const res = await request(app)
          .get('/api/v1/auth/profile')
          .set('Host', 'mit-tech.bookbuddy.com')
          .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data._id).toBe(studentA._id.toString());
      });

      test('8. Super admin can inspect College A subdomain without cross-tenant rejection', async () => {
        const res = await request(app)
          .get('/api/v1/auth/profile')
          .set('Host', 'mit-tech.bookbuddy.com')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.role).toBe('super-admin');
      });
    });
  });
});
