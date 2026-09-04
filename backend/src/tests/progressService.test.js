const mongoose = require('mongoose');
const ReadingProgress = require('../models/ReadingProgress');
const { upsertProgress, getProgress } = require('../services/progressService');

describe('progressService - Upsert & Fetch Reading Progress', () => {
  const userId = new mongoose.Types.ObjectId();
  const resourceId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri =
        process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_progress_service_test';
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
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

  beforeEach(async () => {
    await ReadingProgress.deleteMany({});
  });

  test('upsertProgress & getProgress correctly store and retrieve progress', async () => {
    const saved = await upsertProgress({
      userId,
      resourceId,
      resourceType: 'epub',
      position: { cfi: 'epubcfi(/6/2)', page: 15 },
      percentageComplete: 30,
      deviceId: 'device-mobile',
    });

    expect(saved.percentageComplete).toBe(30);

    const fetched = await getProgress(userId, resourceId);
    expect(fetched).not.toBeNull();
    expect(fetched.percentageComplete).toBe(30);
    expect(fetched.deviceId).toBe('device-mobile');
  });

  test('Acceptance Criteria: Two near-simultaneous upserts for the same user+resource from different deviceIds resolve deterministically to whichever has the later updatedAt', async () => {
    const time1 = new Date('2026-08-20T10:00:00.000Z');
    const time2 = new Date('2026-08-20T10:05:00.000Z'); // Later timestamp

    // Fire near-simultaneous updates where Device B has a LATER timestamp (time2) than Device A (time1)
    const updateDeviceA = upsertProgress({
      userId,
      resourceId,
      resourceType: 'pdf',
      position: { page: 5 },
      percentageComplete: 10,
      deviceId: 'device-A',
      updatedAt: time1,
    });

    const updateDeviceB = upsertProgress({
      userId,
      resourceId,
      resourceType: 'pdf',
      position: { page: 25 },
      percentageComplete: 50,
      deviceId: 'device-B',
      updatedAt: time2,
    });

    await Promise.all([updateDeviceA, updateDeviceB]);

    // Check final state -> must resolve deterministically to device-B (time2)
    const finalProgress = await getProgress(userId, resourceId);
    expect(finalProgress.deviceId).toBe('device-B');
    expect(finalProgress.percentageComplete).toBe(50);
    expect(finalProgress.position.page).toBe(25);
    expect(new Date(finalProgress.updatedAt).getTime()).toBe(time2.getTime());
  });

  test('Out-of-order update with an EARLIER timestamp does not overwrite a NEWER existing progress record', async () => {
    const earlierTime = new Date('2026-08-20T10:00:00.000Z');
    const laterTime = new Date('2026-08-20T10:10:00.000Z');

    // First write with laterTime (e.g. from desktop)
    await upsertProgress({
      userId,
      resourceId,
      resourceType: 'epub',
      position: { cfi: 'epubcfi(/6/10)', page: 40 },
      percentageComplete: 80,
      deviceId: 'desktop-device',
      updatedAt: laterTime,
    });

    // Delayed write arriving later with earlierTime (e.g. offline phone sync)
    const result = await upsertProgress({
      userId,
      resourceId,
      resourceType: 'epub',
      position: { cfi: 'epubcfi(/6/2)', page: 10 },
      percentageComplete: 20,
      deviceId: 'delayed-mobile-device',
      updatedAt: earlierTime,
    });

    // Verify it resolved to the newer record
    expect(result.deviceId).toBe('desktop-device');
    expect(result.percentageComplete).toBe(80);

    const current = await getProgress(userId, resourceId);
    expect(current.deviceId).toBe('desktop-device');
    expect(current.percentageComplete).toBe(80);
  });

  test('Three near-simultaneous writes from different devices resolve deterministically to whichever had the latest timestamp', async () => {
    const t1 = new Date('2026-08-20T12:00:00.000Z');
    const t2 = new Date('2026-08-20T12:10:00.000Z');
    const t3 = new Date('2026-08-20T12:05:00.000Z'); // t2 is latest!

    const req1 = upsertProgress({
      userId,
      resourceId,
      resourceType: 'epub',
      position: { page: 10 },
      percentageComplete: 10,
      deviceId: 'device-1',
      updatedAt: t1,
    });

    const req2 = upsertProgress({
      userId,
      resourceId,
      resourceType: 'epub',
      position: { page: 90 },
      percentageComplete: 90,
      deviceId: 'device-2-latest',
      updatedAt: t2,
    });

    const req3 = upsertProgress({
      userId,
      resourceId,
      resourceType: 'epub',
      position: { page: 50 },
      percentageComplete: 50,
      deviceId: 'device-3',
      updatedAt: t3,
    });

    await Promise.all([req1, req2, req3]);

    const finalState = await getProgress(userId, resourceId);
    expect(finalState.deviceId).toBe('device-2-latest');
    expect(finalState.percentageComplete).toBe(90);
    expect(new Date(finalState.updatedAt).getTime()).toBe(t2.getTime());
  });
});
