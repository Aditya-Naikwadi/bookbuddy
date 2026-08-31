const mongoose = require('mongoose');
const ReadingProgress = require('../models/ReadingProgress');
const { upsertProgress, getProgress } = require('../services/progressService');

describe('Phase 8: progressService Clock Skew Fix-Forward Test', () => {
  const userId = new mongoose.Types.ObjectId();
  const resourceId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_clock_skew_test';
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
      });
    }
    await ReadingProgress.deleteMany({});
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await ReadingProgress.deleteMany({});
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await ReadingProgress.deleteMany({});
  });

  test('Future-skewed client timestamp is clamped to current server time', async () => {
    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours in future

    const result = await upsertProgress({
      userId,
      resourceId,
      resourceType: 'pdf',
      position: { page: 50 },
      percentageComplete: 50,
      deviceId: 'future-skewed-device',
      updatedAt: futureTime,
    });

    expect(result).not.toBeNull();
    const storedTime = new Date(result.updatedAt).getTime();
    expect(storedTime).toBeLessThanOrEqual(Date.now() + 1000);

    // Subsequent normal write at current time can successfully update the progress
    const normalUpdate = await upsertProgress({
      userId,
      resourceId,
      resourceType: 'pdf',
      position: { page: 55 },
      percentageComplete: 55,
      deviceId: 'normal-device',
    });

    expect(normalUpdate.percentageComplete).toBe(55);
    expect(normalUpdate.deviceId).toBe('normal-device');
  });
});
