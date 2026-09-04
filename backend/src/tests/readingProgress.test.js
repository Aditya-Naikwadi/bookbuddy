const mongoose = require('mongoose');
const ReadingProgress = require('../models/ReadingProgress');

describe('ReadingProgress Schema & Upsert Integrity', () => {
  const userId = new mongoose.Types.ObjectId();
  const resourceId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = 'mongodb://127.0.0.1:27017/bookbuddy_progress_test';
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
    }

    await ReadingProgress.deleteMany({});
    await ReadingProgress.init();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await ReadingProgress.deleteMany({});
    }
  });

  test('Creates ReadingProgress document with position, percentageComplete, and deviceId', async () => {
    const doc = await ReadingProgress.create({
      userId,
      resourceId,
      resourceType: 'epub',
      position: { cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)', page: 12, scrollOffset: 450 },
      percentageComplete: 25.5,
      deviceId: 'device-mobile-xyz',
    });

    expect(doc.userId.toString()).toBe(userId.toString());
    expect(doc.resourceId.toString()).toBe(resourceId.toString());
    expect(doc.resourceType).toBe('epub');
    expect(doc.position.cfi).toBe('epubcfi(/6/4[chapter1]!/4/2/1:0)');
    expect(doc.position.page).toBe(12);
    expect(doc.position.scrollOffset).toBe(450);
    expect(doc.percentageComplete).toBe(25.5);
    expect(doc.deviceId).toBe('device-mobile-xyz');
  });

  test('Acceptance Criteria: Repeated upserts for the same user+resource always update the single existing document, never create duplicates', async () => {
    await ReadingProgress.deleteMany({});

    // First upsert -> creates initial document
    const doc1 = await ReadingProgress.upsertProgress(
      { userId, resourceId },
      {
        resourceType: 'pdf',
        position: { page: 5, scrollOffset: 120 },
        percentageComplete: 10,
        deviceId: 'reader-tablet-1',
      }
    );

    expect(doc1.position.page).toBe(5);
    expect(doc1.percentageComplete).toBe(10);

    const countAfterFirst = await ReadingProgress.countDocuments({ userId, resourceId });
    expect(countAfterFirst).toBe(1);

    // Second upsert -> updates the existing document
    const doc2 = await ReadingProgress.upsertProgress(
      { userId, resourceId },
      {
        resourceType: 'pdf',
        position: { page: 28, scrollOffset: 340 },
        percentageComplete: 55,
        deviceId: 'reader-laptop-2',
      }
    );

    expect(doc2._id.toString()).toBe(doc1._id.toString()); // Same document ID
    expect(doc2.position.page).toBe(28);
    expect(doc2.percentageComplete).toBe(55);
    expect(doc2.deviceId).toBe('reader-laptop-2');

    // Document count MUST still be 1 (no duplicates created)
    const countAfterSecond = await ReadingProgress.countDocuments({ userId, resourceId });
    expect(countAfterSecond).toBe(1);
  });

  test('Enforces compound unique index { userId: 1, resourceId: 1 } at DB layer', async () => {
    await ReadingProgress.deleteMany({});
    await ReadingProgress.create({
      userId,
      resourceId,
      resourceType: 'epub',
      position: { page: 1 },
      percentageComplete: 5,
    });

    let error = null;
    try {
      await ReadingProgress.create({
        userId,
        resourceId,
        resourceType: 'epub',
        position: { page: 2 },
        percentageComplete: 10,
      });
    } catch (err) {
      error = err;
    }

    expect(error).not.toBeNull();
    expect(error.code).toBe(11000);
  });
});
