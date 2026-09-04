const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';

jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const StudentUploadBatch = require('../models/StudentUploadBatch');
const { generateAccessToken } = require('../utils/token');

describe('F15 Security Test Suite — Bulk Roster Upload, Token Activation & Scoped Auth', () => {
  let collegeA;
  let collegeB;
  let adminUserA;
  let adminTokenA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await User.deleteMany({});
    await College.deleteMany({});
    await StudentUploadBatch.deleteMany({});

    collegeA = await College.create({
      name: 'Springfield University',
      code: 'SPRINGFIELD',
      slug: 'springfield',
      status: 'active',
      isActive: true,
    });

    collegeB = await College.create({
      name: 'Shelbyville Institute',
      code: 'SHELBYVILLE',
      slug: 'shelbyville',
      status: 'active',
      isActive: true,
    });

    adminUserA = await User.create({
      studentId: 'ADM-001',
      name: 'Springfield Admin',
      email: 'admin@springfield.edu',
      password: 'Password123!',
      role: 'college-admin',
      collegeId: collegeA._id,
      status: 'active',
    });

    adminTokenA = generateAccessToken({
      id: adminUserA._id,
      sub: adminUserA._id,
      role: 'college-admin',
      collegeId: collegeA._id,
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('1. Dry-Run Isolation Check', () => {
    it('confirms validate (step 1) writes ZERO user/student records to DB', async () => {
      const initialCount = await User.countDocuments({ role: 'student' });

      const csvContent =
        'StudentId,Name,Email,Program,Year\n' +
        'STU-DRY-101,Dry Run Student,dryrun@springfield.edu,Computer Science,Year 1\n';

      const res = await request(app)
        .post('/api/admin/students/upload/validate')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .attach('file', Buffer.from(csvContent), 'dry_run_roster.csv');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.toCreateCount).toBe(1);

      // Verify ZERO student accounts created in database
      const finalCount = await User.countDocuments({ role: 'student' });
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('2. Session-Derived collegeId Enforcer', () => {
    it('strictly enforces session-derived collegeId even if file contains spoofed college identifier', async () => {
      const validRowsPayload = [
        {
          studentId: 'STU-SPOOF-01',
          name: 'Spoof Test Student',
          email: 'spoof@springfield.edu',
          program: 'Robotics',
          year: 'Year 1',
          fileCollegeId: collegeB._id.toString(), // Attempted spoof of College B
        },
      ];

      // Validate dry-run
      const batch = await StudentUploadBatch.create({
        collegeId: collegeA._id,
        uploadedBy: adminUserA._id,
        fileName: 'spoof_test.csv',
        totalRows: 1,
        validRowsCount: 1,
        createdCount: 1,
        updatedCount: 0,
        status: 'preview',
      });

      const commitRes = await request(app)
        .post('/api/admin/students/upload/commit')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send({
          batchId: batch._id,
          validRows: validRowsPayload,
        });

      expect(commitRes.statusCode).toBe(200);
      expect(commitRes.body.summary.createdCount).toBe(1);

      const createdStudent = await User.findOne({ studentId: 'STU-SPOOF-01' });
      expect(createdStudent).toBeDefined();
      // MUST belong to Admin's session collegeA, NEVER spoofed collegeB!
      expect(createdStudent.collegeId.toString()).toBe(collegeA._id.toString());
    });
  });

  describe('3. Cross-College studentId Collision', () => {
    it('creates same studentId at College A and College B independently without collision', async () => {
      const sharedStudentId = 'ROLL-9999';

      const studentA = await User.create({
        collegeId: collegeA._id,
        studentId: sharedStudentId,
        name: 'Alice Springfield',
        email: 'alice@springfield.edu',
        password: 'Password123!',
        role: 'student',
        status: 'active',
      });

      const studentB = await User.create({
        collegeId: collegeB._id,
        studentId: sharedStudentId,
        name: 'Bob Shelbyville',
        email: 'bob@shelbyville.edu',
        password: 'Password123!',
        role: 'student',
        status: 'active',
      });

      expect(studentA.studentId).toBe(sharedStudentId);
      expect(studentB.studentId).toBe(sharedStudentId);

      // Verify login scoping by college context
      const loginResA = await request(app).post('/api/v1/auth/login').send({
        studentId: sharedStudentId,
        password: 'Password123!',
        collegeSlug: 'springfield',
      });

      expect(loginResA.statusCode).toBe(200);
      expect(loginResA.body.user.name).toBe('Alice Springfield');
      expect(loginResA.body.user.collegeId.toString()).toBe(collegeA._id.toString());
    });
  });

  describe('4. Token-Based Activation Single-Use & Expiry', () => {
    it('verifies unactivated account cannot log in prior to activation', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await User.create({
        collegeId: collegeA._id,
        studentId: 'STU-UNACT-01',
        name: 'Unactivated Student',
        email: 'unactivated@springfield.edu',
        role: 'student',
        status: 'invited',
        activationTokenHash: tokenHash,
        activationTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });

      const loginAttempt = await request(app).post('/api/v1/auth/login').send({
        studentId: 'STU-UNACT-01',
        password: 'AnyPassword123!',
        collegeSlug: 'springfield',
      });

      expect(loginAttempt.statusCode).toBe(400);
      expect(loginAttempt.body.message).toMatch(/account has not been activated/i);
    });

    it('activates account with single-use token and invalidates token upon consumption', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await User.create({
        collegeId: collegeA._id,
        studentId: 'STU-ACTIV-02',
        name: 'Token Consumer',
        email: 'tokenconsumer@springfield.edu',
        role: 'student',
        status: 'invited',
        activationTokenHash: tokenHash,
        activationTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });

      // 1. Verify token
      const verifyRes = await request(app).get(`/api/v1/auth/activate/verify?token=${rawToken}`);
      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.body.student.studentId).toBe('STU-ACTIV-02');

      // 2. Consume token (set password)
      const activateRes = await request(app).post('/api/v1/auth/activate/confirm').send({
        token: rawToken,
        newPassword: 'MyNewSecurePassword123!',
      });

      expect(activateRes.statusCode).toBe(200);
      expect(activateRes.body.success).toBe(true);
      expect(activateRes.body.token).toBeDefined();

      // 3. Attempt token reuse — MUST FAIL
      const reuseRes = await request(app).post('/api/v1/auth/activate/confirm').send({
        token: rawToken,
        newPassword: 'AnotherPassword123!',
      });

      expect(reuseRes.statusCode).toBe(400);
      expect(reuseRes.body.message).toMatch(/invalid or already consumed/i);
    });

    it('rejects expired activation token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await User.create({
        collegeId: collegeA._id,
        studentId: 'STU-EXPIRED-03',
        name: 'Expired Student',
        email: 'expired@springfield.edu',
        role: 'student',
        status: 'invited',
        activationTokenHash: tokenHash,
        activationTokenExpiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const activateRes = await request(app).post('/api/v1/auth/activate/confirm').send({
        token: rawToken,
        newPassword: 'MyNewSecurePassword123!',
      });

      expect(activateRes.statusCode).toBe(400);
      expect(activateRes.body.message).toMatch(/activation link has expired/i);
    });
  });
});
