const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const { ROLES } = require('@bookbuddy/shared/constants/roles');
const { resetAllLimiters } = require('../middlewares/rateLimiters');

describe('Identity Casing and Normalization Login Regression Test Suite', () => {
  let college;
  const rawPassword = 'Password123!';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    await College.deleteMany({ code: 'CASING_TEST_COLL' });
    college = await College.create({
      name: 'Casing Normalization College',
      code: 'CASING_TEST_COLL',
      domain: 'casingtest.edu',
      slug: 'casing-test-coll',
      status: 'active',
      isActive: true,
    });

    // Create a known student account with canonical normalized credentials
    await User.deleteMany({ collegeId: college._id });
    await User.create({
      name: 'Alex Johnson',
      email: 'alex.johnson@casingtest.edu', // Canonical: lowercase, trimmed
      studentId: 'stu-alex-999', // Canonical: lowercase, trimmed
      password: rawPassword,
      role: ROLES.STUDENT,
      collegeId: college._id,
      status: 'active',
      membershipStatus: 'active',
      isEmailVerified: true,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ collegeId: college._id });
    await College.deleteMany({ _id: college._id });
  });

  beforeEach(() => {
    resetAllLimiters();
  });

  describe('1. Email Casing & Trimming Invariance', () => {
    it('authenticates successfully with canonical lowercase email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alex.johnson@casingtest.edu',
          password: rawPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('alex.johnson@casingtest.edu');
      expect(res.body.user.role).toBe(ROLES.STUDENT);
      expect(res.body.accessToken).toBeDefined();
    });

    it('authenticates successfully with mixed-case email (Alex.Johnson@CasingTest.EDU)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'Alex.Johnson@CasingTest.EDU',
          password: rawPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('alex.johnson@casingtest.edu');
      expect(res.body.user.studentId).toBe('stu-alex-999');
      expect(res.body.user.role).toBe(ROLES.STUDENT);
    });

    it('authenticates successfully with UPPERCASE email and surrounding whitespace', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: '   ALEX.JOHNSON@CASINGTEST.EDU   ',
          password: rawPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('alex.johnson@casingtest.edu');
      expect(res.body.user.studentId).toBe('stu-alex-999');
    });
  });

  describe('2. StudentId Casing & Trimming Invariance', () => {
    it('authenticates successfully with canonical lowercase studentId', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'stu-alex-999',
          collegeId: college._id.toString(),
          password: rawPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.studentId).toBe('stu-alex-999');
      expect(res.body.user.email).toBe('alex.johnson@casingtest.edu');
      expect(res.body.user.role).toBe(ROLES.STUDENT);
    });

    it('authenticates successfully with UPPERCASE studentId (STU-ALEX-999)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: 'STU-ALEX-999',
          collegeId: college._id.toString(),
          password: rawPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.studentId).toBe('stu-alex-999');
      expect(res.body.user.email).toBe('alex.johnson@casingtest.edu');
    });

    it('authenticates successfully with mixed-case studentId and whitespace (  Stu-Alex-999  )', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          studentId: '  Stu-Alex-999  ',
          collegeId: college._id.toString(),
          password: rawPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.studentId).toBe('stu-alex-999');
    });
  });

  describe('3. Registration Write-Time Normalization Roundtrip', () => {
    it('registers user with mixed-case email/studentId and verifies stored record is canonical', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Sarah Connor',
          email: '  Sarah.Connor@CasingTest.EDU  ',
          studentId: '  CS-SARAH-007  ',
          password: 'Password123!',
          collegeId: college._id.toString(),
          role: 'college-student', // Client sends legacy drifted role
        });

      expect([200, 201, 202]).toContain(regRes.status);
      expect(regRes.body.success).toBe(true);

      if (regRes.status === 202) {
        // Created a StudentJoinRequest awaiting approval
        expect(regRes.body.requiresApproval).toBe(true);
        expect(regRes.body.data.email).toBe('sarah.connor@casingtest.edu');
        expect(regRes.body.data.studentId).toBe('cs-sarah-007');
      } else if (regRes.body.user) {
        expect(regRes.body.user.email).toBe('sarah.connor@casingtest.edu');
        expect(regRes.body.user.studentId).toBe('cs-sarah-007');
        expect(regRes.body.user.role).toBe(ROLES.STUDENT);
      }
    });
  });

  describe('4. Password Validation', () => {
    it('rejects incorrect password cleanly regardless of casing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ALEX.JOHNSON@CASINGTEST.EDU',
          password: 'WrongPassword!',
        });

      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });
});
