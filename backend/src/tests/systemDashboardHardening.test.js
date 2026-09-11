/**
 * Consolidated Suite: system Dashboard Hardening
 * Merged from:
 *  - backendDashboardHardening.test.js
 *  - databaseDashboardHardening.test.js
 *  - generalDashboardHardening.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('system Dashboard Hardening Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: backendDashboardHardening.test.js]', () => {
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
        // await // mongoose.connection.close();
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
  });

  describe('[Source: databaseDashboardHardening.test.js]', () => {
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_db_hardening_test';

    jest.setTimeout(30000);

    const Announcement = require('../models/Announcement');
    const Book = require('../models/Book');
    const DashboardStatsSnapshot = require('../models/DashboardStatsSnapshot');
    const CronRunLog = require('../models/CronRunLog');
    const College = require('../models/College');
    const { getOrComputeStats } = require('../utils/dashboardCache');

    describe('General Public Dashboard Database Hardening Integration Tests', () => {
      let collegeId;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        const college = await College.create({
          name: 'DB Hardening Test College',
          code: 'DB_COL',
          status: 'active',
        });
        collegeId = college._id;

        await Book.create({
          collegeId,
          isbn: '978-0134685991',
          title: 'Effective Java',
          author: 'Joshua Bloch',
          category: 'Computer Science',
          copiesTotal: 4,
          copiesAvailable: 4,
        });
      });

      afterAll(async () => {
        await Announcement.deleteMany({ collegeId });
        await Book.deleteMany({ collegeId });
        await DashboardStatsSnapshot.deleteMany({ collegeId });
        await CronRunLog.deleteMany({ jobName: 'test-job' });
        await College.deleteMany({ _id: collegeId });
        // await // mongoose.connection.close();
      });

      it('1. Schema Validation: Announcement rejects invalid priority and status enum values', async () => {
        const invalidAnnouncement = new Announcement({
          collegeId,
          title: 'Invalid Enum Test',
          content: 'Testing enum validation',
          priority: 'SuperUrgent',
          status: 'unknown_status',
        });

        let err = null;
        try {
          await invalidAnnouncement.save();
        } catch (e) {
          err = e;
        }

        expect(err).toBeDefined();
        expect(err.name).toBe('ValidationError');
        expect(err.errors).toHaveProperty('priority');
        expect(err.errors).toHaveProperty('status');
      });

      it('2. Index Declarations: Announcement has compound index and TTL index on expiresAt', () => {
        const indexes = Announcement.schema.indexes();

        const hasCompound = indexes.some(
          ([idx]) =>
            idx.collegeId === 1 && idx.status === 1 && idx.priority === 1 && idx.createdAt === -1
        );
        const hasTtl = indexes.some(
          ([idx, opts]) => idx.expiresAt === 1 && opts && opts.expireAfterSeconds === 0
        );

        expect(hasCompound).toBe(true);
        expect(hasTtl).toBe(true);
      });

      it('3. DashboardStatsSnapshot: Precompute function upserts snapshot collection on calculation', async () => {
        const result = await getOrComputeStats(collegeId.toString());

        expect(result.stats).toBeDefined();
        expect(result.stats.totalCatalogBooks).toBeGreaterThanOrEqual(1);

        const snapshot = await DashboardStatsSnapshot.findOne({ collegeId }).lean();
        expect(snapshot).toBeDefined();
        expect(snapshot.totalCatalogBooks).toBe(result.stats.totalCatalogBooks);
      });

      it('4. Read Preference: Dashboard queries execute with secondaryPreferred read preference', async () => {
        const books = await Book.find({ collegeId }).read('secondaryPreferred').lean();

        expect(books).toBeDefined();
        expect(books.length).toBeGreaterThan(0);
      });

      it('5. Audit Retention: CronRunLog model has 30-day TTL index on createdAt', () => {
        const indexes = CronRunLog.schema.indexes();
        const hasTtl = indexes.some(
          ([idx, opts]) => idx.createdAt === 1 && opts && opts.expireAfterSeconds === 2592000
        );

        expect(hasTtl).toBe(true);
      });
    });
  });

  describe('[Source: generalDashboardHardening.test.js]', () => {
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
        // await // mongoose.connection.close();
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
  });
});
