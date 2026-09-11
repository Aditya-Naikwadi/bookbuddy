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
    await mongoose.connection.close();
  });

  test('1. Subdomain extraction accurately identifies tenant slugs and excludes root/reserved hosts', () => {
    // Subdomain host patterns
    expect(extractSubdomain({ headers: { host: 'mit-tech.bookbuddy.com' } })).toBe('mit-tech');
    expect(extractSubdomain({ headers: { host: 'stanford-univ.localhost:5000' } })).toBe(
      'stanford-univ'
    );
    expect(extractSubdomain({ headers: { 'x-tenant-subdomain': 'mit-tech' } })).toBe('mit-tech');

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
