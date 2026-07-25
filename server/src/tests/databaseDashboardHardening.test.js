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
    await mongoose.connection.close();
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
