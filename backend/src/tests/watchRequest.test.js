const mongoose = require('mongoose');
const WatchRequest = require('../models/WatchRequest');

describe('WatchRequest Schema & Duplicate Handling', () => {
  const userId = new mongoose.Types.ObjectId();
  const bookId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_watch_test';
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
      });
    }
    await WatchRequest.deleteMany({});
    await WatchRequest.init();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await WatchRequest.deleteMany({});
    }
  });

  test('DB Layer: Throws code 11000 duplicate key error on duplicate (userId, bookId)', async () => {
    await WatchRequest.create({ userId, bookId });

    let duplicateErr = null;
    try {
      await WatchRequest.create({ userId, bookId });
    } catch (err) {
      duplicateErr = err;
    }

    expect(duplicateErr).not.toBeNull();
    expect(duplicateErr.code).toBe(11000);
  });

  test('Acceptance Criteria: Duplicate watch attempt by same user for same book is a no-op (caught duplicate-key error, no new document)', async () => {
    await WatchRequest.deleteMany({});

    // First watch attempt -> creates document
    const doc1 = await WatchRequest.createWatch({ userId, bookId });
    expect(doc1).not.toBeNull();
    expect(doc1.userId.toString()).toBe(userId.toString());
    expect(doc1.bookId.toString()).toBe(bookId.toString());

    const countAfterFirst = await WatchRequest.countDocuments({ userId, bookId });
    expect(countAfterFirst).toBe(1);

    // Second watch attempt -> caught duplicate-key error, no-op (no new document)
    const doc2 = await WatchRequest.createWatch({ userId, bookId });
    expect(doc2).not.toBeNull();

    const countAfterSecond = await WatchRequest.countDocuments({ userId, bookId });
    expect(countAfterSecond).toBe(1); // Document count remains 1
  });
});
