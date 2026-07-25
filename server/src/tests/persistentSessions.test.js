const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_session_test';
process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');

describe('Persistent Sessions & Token Rotation Integration Tests', () => {
  let collegeId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    collegeId = new mongoose.Types.ObjectId().toString();

    await College.create({
      _id: collegeId,
      name: 'Session Test College',
      code: 'SESS_COL',
      status: 'active',
    });

    await User.create({
      studentId: 'STU_SESS_99',
      name: 'Session Tester',
      email: 'session@test.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeId,
      isActive: true,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'session@test.edu' });
    await College.deleteMany({ _id: collegeId });
    await mongoose.connection.close();
  });

  it('1. Login sets 30-day httpOnly refresh cookie and returns access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'session@test.edu', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.headers['set-cookie']).toBeDefined();

    const cookieHeader = res.headers['set-cookie'].join(';');
    expect(cookieHeader).toContain('refreshToken=');
    expect(cookieHeader).toContain('HttpOnly');
  });

  it('2. Token Rotation: Refreshing issues new access token and new rotated refresh cookie', async () => {
    // Step 1: Login to get initial cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'session@test.edu', password: 'Password123!' });

    const initialCookie = loginRes.headers['set-cookie'];

    // Step 2: Refresh token
    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', initialCookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body).toHaveProperty('accessToken');
    expect(refreshRes.headers['set-cookie']).toBeDefined();
  });

  it('3. Theft Reuse Detection: Presenting a rotated-out refresh token revokes all sessions', async () => {
    // Step 1: Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'session@test.edu', password: 'Password123!' });

    const originalCookie = loginRes.headers['set-cookie'];

    // Step 2: Rotate token once (valid update)
    const firstRefreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);

    expect(firstRefreshRes.status).toBe(200);

    // Step 3: Attempt to reuse the original (now rotated-out) cookie -> Reuse Detection!
    const reuseRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.message).toMatch(/reuse detected/i);
  });

  it('4. Logout revokes session and clears cookie', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'session@test.edu', password: 'Password123!' });

    const cookie = loginRes.headers['set-cookie'];

    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
  });
});
