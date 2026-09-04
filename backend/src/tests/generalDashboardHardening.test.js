const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_dashboard_test';
process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const app = require('../app');
const Announcement = require('../models/Announcement');
const College = require('../models/College');
const Book = require('../models/Book');

describe('General Public Dashboard Gap Analysis & Hardening Integration Tests', () => {
  let collegeId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    collegeId = new mongoose.Types.ObjectId().toString();

    await College.create({
      _id: collegeId,
      name: 'Hardening Test College',
      code: 'HARD_COL',
      status: 'active',
    });

    // Create an active announcement containing potentially unsafe HTML script tags
    await Announcement.create({
      collegeId: collegeId,
      title: '<script>alert("XSS")</script>Spring Book Fair',
      content: '<img src=x onerror=alert(1)>New digital collection released!',
      message: '<img src=x onerror=alert(1)>New digital collection released!',
      isActive: true,
      startDate: new Date(),
    });

    await Book.create({
      collegeId: collegeId,
      isbn: '978-0131103627',
      title: 'Security Analysis in Node.js',
      author: 'A. Tester',
      category: 'Computer Science',
      copiesTotal: 5,
      copiesAvailable: 5,
    });
  });

  afterAll(async () => {
    await Announcement.deleteMany({ collegeId });
    await Book.deleteMany({ collegeId });
    await College.deleteMany({ _id: collegeId });
    await mongoose.connection.close();
  });

  it('1. Public Access: /api/v1/dashboards/general/home-data is accessible without auth wall', async () => {
    const res = await request(app).get(
      `/api/v1/dashboards/general/home-data?collegeId=${collegeId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('stats');
    expect(res.body.data).toHaveProperty('announcements');
    expect(res.body.data).toHaveProperty('popularBooks');
  });

  it('2. Output Sanitization: Admin-authored announcements are HTML-escaped before render', async () => {
    const res = await request(app).get(
      `/api/v1/dashboards/general/home-data?collegeId=${collegeId}`
    );

    expect(res.status).toBe(200);
    const announcements = res.body.data.announcements;
    expect(announcements.length).toBeGreaterThan(0);

    const announcement = announcements[0];
    expect(announcement.title).not.toContain('<script>');
    expect(announcement.title).toContain('&amp;lt;script&amp;gt;');
    expect(announcement.content).not.toContain('<img');
    expect(announcement.content).toContain('&amp;lt;img');
  });

  it('3. Scalability & Edge Caching: Cache-Control header is set for public dashboard responses', async () => {
    const res = await request(app).get(
      `/api/v1/dashboards/general/home-data?collegeId=${collegeId}`
    );

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBeDefined();
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['cache-control']).toContain('stale-while-revalidate=300');
  });

  it('4. Security Headers: Content-Security-Policy header is configured', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });
});
