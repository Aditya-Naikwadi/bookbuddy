// Integration tests verifying authentication security and multi-tenancy scoping.
const request = require('supertest');
const mongoose = require('mongoose');

// Point environment variables to test database before requiring app
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';
process.env.JWT_SECRET = 'testjwtsecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretkey999';
process.env.JWT_ACCESS_EXPIRY = '5s';
process.env.JWT_REFRESH_EXPIRY = '10s';
// raised from default 30s: multi-step integration test, verified slow under coverage instrumentation only, see 2026-07-15 audit
jest.setTimeout(90000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');

const getCookieFromRes = (res, cookieName) => {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return undefined;
  const cookie = cookies.find((c) => c.startsWith(`${cookieName}=`));
  if (!cookie) return undefined;
  return cookie.split(';')[0].split('=')[1];
};

describe('Auth & Multi-Tenancy Backbone API Integration Tests', () => {
  let collegeA;
  let collegeB;
  let studentAData;
  let studentBData;

  beforeAll(async () => {
    // Connect to test database if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean database before starting
    await College.deleteMany({});
    await User.deleteMany({});

    // Seed Colleges
    collegeA = await College.create({ name: 'Test College A', code: 'TCA' });
    collegeB = await College.create({ name: 'Test College B', code: 'TCB' });

    studentAData = {
      studentId: 'STU_A_001',
      name: 'Student A',
      email: 'student.a@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id.toString(),
    };

    studentBData = {
      studentId: 'STU_B_002',
      name: 'Student B',
      email: 'student.b@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id.toString(),
    };
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  // Assertion 1: Register student returns tokens, hides password
  it('1. should register a student successfully, return tokens, and omit password', async () => {
    const res = await request(app).post('/api/auth/register').send(studentAData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    const cookieToken = getCookieFromRes(res, 'refreshToken');
    expect(cookieToken).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.refreshTokenHash).toBeUndefined();
  });

  it('1b. should register a public user without explicit collegeId and assign default active college', async () => {
    const res = await request(app).post('/api/auth/register').send({
      studentId: 'STU_NO_COLLEGE',
      name: 'Public Signup User',
      email: 'nocollege@bookbuddy.com',
      password: 'password123',
      role: 'general',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.collegeId).toBeDefined();
  });

  // Assertion 2: Login with correct credentials returns tokens
  it('2. should login successfully with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: studentAData.email,
      password: studentAData.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    const cookieToken = getCookieFromRes(res, 'refreshToken');
    expect(cookieToken).toBeDefined();
  });

  // Assertion 3: Login with wrong password returns 401
  it('3. should reject login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: studentAData.email,
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // Assertion 4: Access protected route without token returns 401
  it('4. should reject access to debug tenant check route without token', async () => {
    const res = await request(app).get('/api/_debug/tenant-check');
    expect(res.status).toBe(401);
  });

  // Assertion 5: Access protected route with tampered token returns 401
  it('5. should reject access with tampered token', async () => {
    const res = await request(app)
      .get('/api/_debug/tenant-check')
      .set('Authorization', 'Bearer invalidtokenhere');

    expect(res.status).toBe(401);
  });

  // Assertion 6: Access college_admin-only route as student returns 403
  it('6. should reject access to admin portal dashboard as student (403)', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: studentAData.email,
      password: studentAData.password,
    });

    const res = await request(app)
      .get('/api/dashboards/admin-portal/analytics')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(res.status).toBe(403);
  });

  // Assertion 7: Two users in different colleges isolate tenant filter
  it("7. should verify student A's tenantFilter does NOT match student B's collegeId", async () => {
    // Register Student B
    await request(app).post('/api/auth/register').send(studentBData);

    // Login Student A
    const loginARes = await request(app).post('/api/auth/login').send({
      email: studentAData.email,
      password: studentAData.password,
    });

    // Login Student B
    const loginBRes = await request(app).post('/api/auth/login').send({
      email: studentBData.email,
      password: studentBData.password,
    });

    // Get Tenant Scope for Student A
    const scopeARes = await request(app)
      .get('/api/_debug/tenant-check')
      .set('Authorization', `Bearer ${loginARes.body.accessToken}`);

    // Get Tenant Scope for Student B
    const scopeBRes = await request(app)
      .get('/api/_debug/tenant-check')
      .set('Authorization', `Bearer ${loginBRes.body.accessToken}`);

    expect(scopeARes.status).toBe(200);
    expect(scopeBRes.status).toBe(200);

    // Cross-Tenant Assertion: Make sure collegeId filters are isolated
    expect(scopeARes.body.tenantFilter.collegeId).toBe(collegeA._id.toString());
    expect(scopeBRes.body.tenantFilter.collegeId).toBe(collegeB._id.toString());
    expect(scopeARes.body.tenantFilter.collegeId).not.toBe(scopeBRes.body.tenantFilter.collegeId);
  });

  // Assertion 8: Refresh token rotation - old refresh token rejected
  it('8. should perform refresh token rotation and reject reused old refresh token', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: studentAData.email,
      password: studentAData.password,
    });

    const oldRefreshToken = getCookieFromRes(loginRes, 'refreshToken');

    // First rotation request
    const refreshRes1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${oldRefreshToken}`]);

    expect(refreshRes1.status).toBe(200);
    expect(refreshRes1.body.accessToken).toBeDefined();

    // Replay attack: try using oldRefreshToken again (must be rejected)
    const refreshRes2 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${oldRefreshToken}`]);

    expect(refreshRes2.status).toBe(401);
  });

  // Assertion 9: Logout invalidates refresh token
  it('9. should invalidate refresh token on logout', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: studentAData.email,
      password: studentAData.password,
    });

    const refreshToken = getCookieFromRes(loginRes, 'refreshToken');
    const accessToken = loginRes.body.accessToken;

    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    expect(logoutRes.status).toBe(200);

    // Attempting to refresh with invalidated token should fail
    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(refreshRes.status).toBe(401);
  });

  // Assertion 10: Reject administrative role injection on registration
  it('10. should ignore/reject role injection of college-admin on registration', async () => {
    const maliciousData = {
      studentId: 'STU_MAL_003',
      name: 'Malicious Admin',
      email: 'malicious.admin@test.com',
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id.toString(),
    };

    const res = await request(app).post('/api/auth/register').send(maliciousData);

    // Zod validation or controller should reject it with 400 or 403
    expect([400, 403]).toContain(res.status);

    // Also verify no such user was registered
    const user = await User.findOne({ email: 'malicious.admin@test.com' });
    expect(user).toBeNull();
  });
});
