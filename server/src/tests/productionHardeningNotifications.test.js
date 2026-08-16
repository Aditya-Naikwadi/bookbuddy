const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret';
jest.setTimeout(60000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const DeviceToken = require('../models/DeviceToken');
const NotificationLog = require('../models/NotificationLog');
const notificationService = require('../services/notificationService');
const { generateTokenPair } = require('../utils/token');

describe('ITEM 2 — Real Notification Delivery (Email/Push), Device Tokens & Delivery Logs', () => {
  let testCollege;
  let testUser;
  let authToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await College.deleteMany({});
    await DeviceToken.deleteMany({});
    await NotificationLog.deleteMany({});

    delete process.env.EMAIL_DRIVER_THROW;
    delete process.env.PUSH_DRIVER_THROW;

    testCollege = await College.create({
      name: 'Notification Testing Institute',
      code: 'NOTIF101',
    });

    testUser = await User.create({
      studentId: 'STU_NOTIF_001',
      name: 'Notification Test Student',
      email: 'notiftest@bookbuddy.com',
      password: 'Password@123',
      role: 'student',
      collegeId: testCollege._id,
    });

    const tokens = generateTokenPair(testUser);
    authToken = tokens.accessToken;
  });

  test('2.1 Triggering a notification produces NotificationLog entries with status sent', async () => {
    const notification = await notificationService.notify(
      testUser._id,
      'LOAN_DUE',
      'Your book "Introduction to Algorithms" is due tomorrow.'
    );

    expect(notification).toBeDefined();
    expect(notification.type).toBe('LOAN_DUE');

    const logs = await NotificationLog.find({ userId: testUser._id });
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const emailLog = logs.find((l) => l.channel === 'email');
    expect(emailLog).toBeDefined();
    expect(emailLog.status).toBe('sent');
    expect(emailLog.provider).toBeDefined();
    expect(emailLog.error).toBeNull();
  });

  test('2.2 Verify retry-and-log-failure behavior when provider throws', async () => {
    process.env.EMAIL_DRIVER_THROW = 'true';

    const logEntry = await notificationService.sendEmail(
      testUser._id,
      testUser.email,
      'LOAN_OVERDUE',
      'Your loan is overdue.'
    );

    expect(logEntry).toBeDefined();
    expect(logEntry.status).toBe('failed');
    expect(logEntry.error).toContain('Email provider connection timeout');

    const failedLogsInDb = await NotificationLog.find({ userId: testUser._id, status: 'failed' });
    expect(failedLogsInDb.length).toBe(1);
    expect(failedLogsInDb[0].channel).toBe('email');
  });

  test('2.3 Register and delete FCM device token via API', async () => {
    const regRes = await request(app)
      .post('/api/v1/notifications/device-token')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ fcmToken: 'fcm_test_token_abc123', platform: 'web' });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);

    const devicesInDb = await DeviceToken.find({ userId: testUser._id }).select('+fcmToken');
    expect(devicesInDb.length).toBe(1);
    expect(devicesInDb[0].fcmToken).toBe('fcm_test_token_abc123');

    const delRes = await request(app)
      .delete('/api/v1/notifications/device-token')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ fcmToken: 'fcm_test_token_abc123' });

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const remainingDevices = await DeviceToken.find({ userId: testUser._id });
    expect(remainingDevices.length).toBe(0);
  });

  test('2.4 GET /api/notifications/history retrieves user delivery logs', async () => {
    await NotificationLog.create({
      userId: testUser._id,
      channel: 'email',
      type: 'RENEWAL_DUE',
      status: 'sent',
      provider: 'sandbox-nodemailer',
    });

    await NotificationLog.create({
      userId: testUser._id,
      channel: 'push',
      type: 'RENEWAL_DUE',
      status: 'sent',
      provider: 'sandbox-fcm',
    });

    const res = await request(app)
      .get('/api/v1/notifications/history')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].userId.toString()).toBe(testUser._id.toString());
  });
});
