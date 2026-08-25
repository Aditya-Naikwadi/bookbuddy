const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const RegistrationRequest = require('../models/RegistrationRequest');

describe('Registration Persistence & Multi-Tenant Scoping Regression Tests', () => {
  let collegeA;
  let collegeB;

  beforeEach(async () => {
    await User.deleteMany({});
    await College.deleteMany({});
    await RegistrationRequest.deleteMany({});

    collegeA = await College.create({
      name: 'College Alpha',
      code: 'ALPHA_01',
      status: 'active',
      isActive: true,
      domain: 'alpha.edu',
    });

    collegeB = await College.create({
      name: 'College Beta',
      code: 'BETA_01',
      status: 'active',
      isActive: true,
      domain: 'beta.edu',
    });
  });

  it('definitively persists student registration details to MongoDB User collection after 2-step verification', async () => {
    const studentData = {
      name: 'Jane Doe',
      email: 'jane@alpha.edu',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      collegeId: collegeA._id.toString(),
      studentId: 'STU-1001',
      department: 'Computer Science',
      termsAccepted: true,
    };

    // Step 1: Submit self-registration
    const regRes = await request(app).post('/api/registration/student').send(studentData);

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.email).toBe('jane@alpha.edu');

    // Verify RegistrationRequest document exists in DB
    const regReqDoc = await RegistrationRequest.findOne({
      'studentData.email': 'jane@alpha.edu',
      status: 'unverified',
    });
    expect(regReqDoc).not.toBeNull();
    expect(regReqDoc.studentData.studentId).toBe('STU-1001');
    expect(regReqDoc.studentData.verificationOTP).toBeDefined();

    const devOtp = regRes.body.data.devOtp || regReqDoc.studentData.verificationOTP;

    // Step 2: Verify email via OTP
    const verifyRes = await request(app).post('/api/registration/verify-email').send({
      email: 'jane@alpha.edu',
      otp: devOtp,
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    // Step 3: Direct MongoDB Verification — Assert User document is saved in database
    const persistedUser = await User.findOne({ email: 'jane@alpha.edu' });
    expect(persistedUser).not.toBeNull();
    expect(persistedUser._id).toBeDefined();
    expect(persistedUser.name).toBe('Jane Doe');
    expect(persistedUser.studentId).toBe('STU-1001');
    expect(persistedUser.collegeId.toString()).toBe(collegeA._id.toString());
    expect(persistedUser.role).toBe('student');
    expect(persistedUser.isEmailVerified).toBe(true);
    expect(persistedUser.membershipStatus).toBe('active');
  });

  it('allows duplicate studentId across DIFFERENT colleges (Multi-Tenant Isolation)', async () => {
    // Create user in College A with studentId 'ENROLL-999'
    await User.create({
      studentId: 'ENROLL-999',
      name: 'Student A',
      email: 'studenta@alpha.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeA._id,
      isEmailVerified: true,
    });

    // Register user in College B with the SAME studentId 'ENROLL-999'
    const studentBData = {
      studentId: 'ENROLL-999',
      name: 'Student B',
      email: 'studentb@beta.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeB._id.toString(),
    };

    const registerRes = await request(app).post('/api/auth/register').send(studentBData);

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);

    // Verify both users exist in MongoDB with identical studentId under distinct collegeIds
    const userInCollegeA = await User.findOne({ collegeId: collegeA._id, studentId: 'ENROLL-999' });
    const userInCollegeB = await User.findOne({ collegeId: collegeB._id, studentId: 'ENROLL-999' });

    expect(userInCollegeA).not.toBeNull();
    expect(userInCollegeB).not.toBeNull();
    expect(userInCollegeA._id.toString()).not.toBe(userInCollegeB._id.toString());
  });
});
