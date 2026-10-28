const mongoose = require('mongoose');
const env = require('../config/env');
const DailyMetricSnapshot = require('../models/DailyMetricSnapshot');
const College = require('../models/College');
const Book = require('../models/Book');

jest.setTimeout(30000);

describe('DailyMetricSnapshot Model & Size Projections', () => {
  let collegeId;
  let bookId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
    }
    try {
      await DailyMetricSnapshot.collection.dropIndexes();
    } catch {
      // Ignore if collection does not exist yet
    }
    await DailyMetricSnapshot.syncIndexes();

    const college = await College.create({
      name: 'Metric Snapshot College',
      code: `MSC_${Date.now()}`,
    });
    collegeId = college._id;

    const book = await Book.create({
      collegeId,
      title: 'Database Reliability & Systems',
      author: 'Reliability Team',
      isbn: `978-${Date.now().toString().slice(-10)}`,
      category: 'Engineering',
      copiesTotal: 10,
      copiesAvailable: 10,
    });
    bookId = book._id;
  });

  afterAll(async () => {
    await DailyMetricSnapshot.deleteMany({ collegeId });
    await Book.deleteMany({ collegeId });
    await College.deleteMany({ _id: collegeId });
  });

  it('normalizes dates to UTC midnight and creates a valid snapshot', async () => {
    const rawDate = new Date('2026-10-28T14:35:22.450Z');
    const normalized = DailyMetricSnapshot.normalizeDate(rawDate);

    expect(normalized.toISOString()).toBe('2026-10-28T00:00:00.000Z');

    const snapshot = await DailyMetricSnapshot.create({
      collegeId,
      date: normalized,
      metrics: {
        circulation: {
          loansIssued: 42,
          loansReturned: 38,
          activeLoans: 120,
          overdueLoans: 8,
          renewals: 15,
        },
        fines: {
          finesAccrued: 150,
          finesCollected: 120,
          finesWaived: 10,
          unpaidFinesTotal: 450,
        },
        utilization: {
          activePatrons: 85,
          catalogSearches: 430,
          eresourceViews: 95,
          facilitiesBookings: 24,
        },
        engagement: {
          activeStreaks: 62,
          badgesAwarded: 11,
          readingListAdds: 18,
        },
        bookVelocity: [{ bookId, borrowCount: 9 }],
      },
    });

    expect(snapshot._id).toBeDefined();
    expect(snapshot.metrics.circulation.loansIssued).toBe(42);
    expect(snapshot.metrics.bookVelocity[0].borrowCount).toBe(9);
  });

  it('rejects duplicate snapshots for the same college and calendar date', async () => {
    const normalizedDate = DailyMetricSnapshot.normalizeDate(new Date('2026-10-28T00:00:00.000Z'));

    await expect(
      DailyMetricSnapshot.create({
        collegeId,
        date: normalizedDate,
        metrics: {
          circulation: { loansIssued: 5 },
        },
      })
    ).rejects.toThrow();
  });

  it('verifies exact BSON size is under 2 KB and calculates yearly footprint', async () => {
    // Generate a realistic snapshot with 25 active book checkouts in bookVelocity
    const sampleVelocity = [];
    for (let i = 0; i < 25; i++) {
      sampleVelocity.push({
        bookId: new mongoose.Types.ObjectId(),
        borrowCount: (i % 5) + 1,
      });
    }

    const sampleDoc = {
      _id: new mongoose.Types.ObjectId(),
      collegeId,
      date: new Date('2026-10-29T00:00:00.000Z'),
      metrics: {
        circulation: {
          loansIssued: 120,
          loansReturned: 110,
          activeLoans: 350,
          overdueLoans: 15,
          renewals: 40,
        },
        fines: {
          finesAccrued: 320,
          finesCollected: 280,
          finesWaived: 20,
          unpaidFinesTotal: 840,
        },
        utilization: {
          activePatrons: 210,
          catalogSearches: 1250,
          eresourceViews: 340,
          facilitiesBookings: 65,
        },
        engagement: {
          activeStreaks: 145,
          badgesAwarded: 28,
          readingListAdds: 52,
        },
        bookVelocity: sampleVelocity,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const BSON = mongoose.mongo.BSON;
    const docSize = BSON.calculateObjectSize(sampleDoc);

    // Must be under 2 KB (2048 bytes)
    expect(docSize).toBeLessThan(2048);

    // Annual calculation
    const annualBytes = docSize * 365;
    const annualKB = annualBytes / 1024;

    // Less than 800 KB per year per college
    expect(annualKB).toBeLessThan(800);
  });

  it('verifies TTL index configuration for 365-day retention', async () => {
    const indexes = await DailyMetricSnapshot.collection.indexes();
    const ttlIndex = indexes.find(
      (idx) => idx.key.date === 1 && typeof idx.expireAfterSeconds === 'number'
    );

    expect(ttlIndex).toBeDefined();
    expect(ttlIndex.expireAfterSeconds).toBe(365 * 24 * 60 * 60);
  });
});
