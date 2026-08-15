const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_phase2_prelaunch_test';

const app = require('../app');
const AuditLog = require('../models/AuditLog');
const NotificationLog = require('../models/NotificationLog');
const { captureException } = require('../utils/sentry');

describe('Phase 2 Pre-Launch Checklist Integration Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  });

  test('1. Health check /health returns DB & Redis connectivity status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dbConnection).toBe('connected');
    expect(res.body.redisConnection).toBeDefined();
  });

  test('2. AuditLog retains audit trails indefinitely for compliance and NotificationLog has 90-day TTL index', async () => {
    await AuditLog.syncIndexes();
    await NotificationLog.syncIndexes();

    const auditIndexes = await AuditLog.collection.indexes();
    const ttlAudit = auditIndexes.find((idx) => idx.expireAfterSeconds !== undefined);
    expect(ttlAudit).toBeUndefined(); // Indefinite retention compliance

    const notifIndexes = await NotificationLog.collection.indexes();
    const ttlNotif = notifIndexes.find((idx) => idx.expireAfterSeconds !== undefined);
    expect(ttlNotif).toBeDefined();
    expect(ttlNotif.expireAfterSeconds).toBe(7776000); // 90 days
  });

  test('3. Sentry captureException utility operates safely without crashing', () => {
    expect(() => {
      captureException(new Error('Test background error'), { scope: 'unit-test' });
    }).not.toThrow();
  });
});
