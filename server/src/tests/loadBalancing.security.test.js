const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';

jest.setTimeout(30000);

const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const AuditLog = require('../models/AuditLog');
const EResource = require('../models/EResource');

describe('F14 Security & Load Balancing Suite — Multi-Instance & Health Checks', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('F14.3 — Health Check Endpoint Dependency Checking', () => {
    it('returns 200 with status ok and component breakdown when DB is connected', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dbState).toBe('connected');
      expect(res.body.components).toBeDefined();
      expect(res.body.components.database.status).toBe('healthy');
    });

    it('returns 200 for lightweight warming ping endpoint /api/ping', async () => {
      const res = await request(app).get('/api/ping');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('F14.6 — Tenant-Scoped Compound Indexes Verification', () => {
    it('verifies Loan model has compound indexes with collegeId as leading field', () => {
      const indexes = Loan.schema.indexes();
      const hasCollegeStatusIndex = indexes.some(
        ([idx]) => idx.collegeId === 1 && idx.status === 1
      );
      const hasCollegeUserStatusIndex = indexes.some(
        ([idx]) => idx.collegeId === 1 && idx.userId === 1 && idx.status === 1
      );

      expect(hasCollegeStatusIndex).toBe(true);
      expect(hasCollegeUserStatusIndex).toBe(true);
    });

    it('verifies Fine model has compound index { collegeId: 1, userId: 1, status: 1 }', () => {
      const indexes = Fine.schema.indexes();
      const hasFineIndex = indexes.some(
        ([idx]) => idx.collegeId === 1 && idx.userId === 1 && idx.status === 1
      );
      expect(hasFineIndex).toBe(true);
    });

    it('verifies AuditLog model has compound index { collegeId: 1, action: 1, createdAt: -1 }', () => {
      const indexes = AuditLog.schema.indexes();
      const hasAuditIndex = indexes.some(
        ([idx]) => idx.collegeId === 1 && idx.action === 1 && idx.createdAt === -1
      );
      expect(hasAuditIndex).toBe(true);
    });
  });
});
