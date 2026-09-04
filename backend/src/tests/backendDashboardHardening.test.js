const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_backend_hardening_test';
process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const app = require('../app');
const College = require('../models/College');
const Book = require('../models/Book');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { generateTokenPair } = require('../utils/token');

describe('General Public Dashboard Backend Hardening Integration Tests', () => {
  let collegeA;
  let collegeB;
  let userA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    collegeA = await College.create({
      name: 'College Alpha',
      code: 'ALPHA_COL',
      status: 'active',
    });

    collegeB = await College.create({
      name: 'College Beta',
      code: 'BETA_COL',
      status: 'active',
    });

    userA = await User.create({
      studentId: 'STU_ALPHA_101',
      name: 'Alpha Student',
      email: 'student@alpha.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeA._id,
      isActive: true,
    });

    await Announcement.create({
      collegeId: collegeA._id,
      title: 'Alpha Announcement',
      content: 'Welcome to Alpha College Library!',
      isActive: true,
    });

    await Book.create({
      collegeId: collegeA._id,
      isbn: '978-0321714114',
      title: 'C++ Primer',
      author: 'Stanley Lippman',
      category: 'Computer Science',
      copiesTotal: 10,
      copiesAvailable: 8,
    });

    await Book.create({
      collegeId: collegeB._id,
      isbn: '978-0132350884',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      category: 'Software Engineering',
      copiesTotal: 5,
      copiesAvailable: 3,
    });
  });

  afterAll(async () => {
    await Announcement.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
    await Book.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
    await User.deleteMany({ _id: userA._id });
    await College.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
    await mongoose.connection.close();
  });

  it('1. Aggregate Payload: GET /api/v1/college/:id/dashboard returns stats, hours, announcements, popular & new arrivals', async () => {
    const res = await request(app).get(`/api/v1/college/${collegeA._id}/dashboard`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('collegeId', collegeA._id.toString());
    expect(res.body.data).toHaveProperty('announcements');
    expect(res.body.data.announcements.length).toBeGreaterThan(0);
    expect(res.body.data.announcements[0].title).toBe('Alpha Announcement');
    expect(res.body.data).toHaveProperty('stats');
    expect(res.body.data.stats).toHaveProperty('totalCatalogBooks');
    expect(res.body.data).toHaveProperty('popularBooks');
    expect(res.body.data).toHaveProperty('newArrivals');
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['etag']).toBeDefined();
  });

  it('2. ETag & 304 Conditional Responses: Repeats with If-None-Match return 304 Not Modified', async () => {
    const initialRes = await request(app).get(`/api/v1/college/${collegeA._id}/dashboard`);

    expect(initialRes.status).toBe(200);
    const etag = initialRes.headers['etag'];
    expect(etag).toBeDefined();

    const conditionalRes = await request(app)
      .get(`/api/v1/college/${collegeA._id}/dashboard`)
      .set('If-None-Match', etag);

    expect(conditionalRes.status).toBe(304);
  });

  it('3. Cross-College Tenant Isolation: Logged-in student from College A cannot access College B dashboard', async () => {
    const { accessToken } = generateTokenPair(userA);

    const res = await request(app)
      .get(`/api/v1/college/${collegeB._id}/dashboard`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/forbidden/i);
  });

  it('4. Write-Time Announcement Sanitization: Creating an announcement with script tags sanitizes content at write time', async () => {
    const announcement = await Announcement.create({
      collegeId: collegeA._id,
      title: '<script>alert("hack")</script>Unsafe Title',
      content: '<b onclick=alert(1)>Bold Text</b>',
      isActive: true,
    });

    expect(announcement.title).not.toContain('<script>');
    expect(announcement.title).toContain('&lt;script&gt;');

    await Announcement.deleteOne({ _id: announcement._id });
  });
});
