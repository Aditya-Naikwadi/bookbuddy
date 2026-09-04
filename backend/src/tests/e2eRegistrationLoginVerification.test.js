const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');

describe('E2E User Registration and Login Persistence Verification', () => {
  let defaultCollege;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_e2e_auth_test';
      await mongoose.connect(dbUri);
    }

    await User.deleteMany({ email: 'e2e.testuser@bookbuddy.com' });
    await College.deleteMany({ code: 'E2E_COLLEGE' });

    defaultCollege = await College.create({
      name: 'E2E Test College',
      code: 'E2E_COLLEGE',
      status: 'active',
      isActive: true,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'e2e.testuser@bookbuddy.com' });
    await College.deleteMany({ code: 'E2E_COLLEGE' });
  });

  test('End-to-End Flow: Registration -> DB Persistence (Argon2id Hashed) -> Login Success', async () => {
    const testCredentials = {
      studentId: 'STU_E2E_1001',
      name: 'E2E Test User',
      email: 'e2e.testuser@bookbuddy.com',
      password: 'SecurePassword123!',
      collegeId: defaultCollege._id.toString(),
      role: 'student',
    };

    // 1. Submit Registration Request
    const regResponse = await request(app).post('/api/v1/auth/register').send(testCredentials);

    expect(regResponse.status).toBe(201);
    expect(regResponse.body.success).toBe(true);
    expect(regResponse.body.user).toBeDefined();
    expect(regResponse.body.user.email).toBe('e2e.testuser@bookbuddy.com');
    expect(regResponse.body.user.password).toBeUndefined(); // Ensure plain password is NOT leaked in API response

    // 2. Direct Database Query Verification — Confirm row/document exists with hashed password
    const dbUser = await User.findOne({ email: 'e2e.testuser@bookbuddy.com' }).select('+password');
    expect(dbUser).not.toBeNull();
    expect(dbUser._id).toBeDefined();
    expect(dbUser.name).toBe('E2E Test User');
    expect(dbUser.studentId).toBe('STU_E2E_1001');
    expect(dbUser.password).toBeDefined();
    // Password must be securely hashed with Argon2id (starts with $argon2), NOT stored in plaintext
    expect(dbUser.password).not.toBe('SecurePassword123!');
    expect(dbUser.password.startsWith('$argon2')).toBe(true);

    // 3. Login with Registered Credentials
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'e2e.testuser@bookbuddy.com',
      password: 'SecurePassword123!',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.accessToken).toBeDefined();
    expect(loginResponse.body.user._id).toBe(dbUser._id.toString());
    expect(loginResponse.body.user.email).toBe('e2e.testuser@bookbuddy.com');
  });

  test('Invalid Credentials Rejection: Login fails with wrong password', async () => {
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'e2e.testuser@bookbuddy.com',
      password: 'WrongPassword999!',
    });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.success).toBe(false);
  });
});
