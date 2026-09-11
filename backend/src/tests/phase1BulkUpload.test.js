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
    await mongoose.connection.close();
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
