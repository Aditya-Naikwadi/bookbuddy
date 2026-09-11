const request = require('supertest');
const mongoose = require('mongoose');
const axios = require('axios');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const StudentUploadBatch = require('../models/StudentUploadBatch');
const { generateAccessToken } = require('../utils/token');
const smsService = require('../services/smsService');

jest.mock('axios');

describe('SMS Credential Delivery & Handout Fallback Integration Tests', () => {
  let college;
  let admin;
  let adminToken;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test');
    }

    await College.deleteMany({});
    await User.deleteMany({});
    await StudentUploadBatch.deleteMany({});

    college = await College.create({
      name: 'Pacific Coast University',
      slug: 'pacific-coast',
      code: 'PCU',
      status: 'active',
      domain: 'pacific.edu',
    });

    admin = await User.create({
      studentId: 'ADM-PCU-001',
      name: 'College Admin',
      email: 'admin@pacific.edu',
      password: 'StrongPassword123!',
      role: 'college-admin',
      collegeId: college._id,
      status: 'active',
      isActive: true,
    });

    adminToken = generateAccessToken(admin);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await StudentUploadBatch.deleteMany({});
  });

  describe('1. smsService Unit & AppSec Hardening', () => {
    it('reports isTwilioConfigured as false when env variables are missing', () => {
      delete process.env.TWILIO_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_FROM_NUMBER;

      expect(smsService.isTwilioConfigured()).toBe(false);
    });

    it('reports isTwilioConfigured as true when all credentials are set', () => {
      process.env.TWILIO_SID = 'AC_test_1234567890';
      process.env.TWILIO_AUTH_TOKEN = 'auth_token_secret_123';
      process.env.TWILIO_FROM_NUMBER = '+15550001111';

      expect(smsService.isTwilioConfigured()).toBe(true);
    });

    it('masks phone numbers to protect student privacy and PII in logs', () => {
      expect(smsService.maskPhoneNumber('+15551234567')).toBe('+15***4567');
      expect(smsService.maskPhoneNumber('5551234567')).toBe('555***4567');
      expect(smsService.maskPhoneNumber('')).toBe('***');
    });

    it('returns fallbackToHandout: true when Twilio is unconfigured', async () => {
      delete process.env.TWILIO_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_FROM_NUMBER;

      const result = await smsService.sendCredentialSMS({
        to: '+15551234567',
        studentId: 'STU-001',
        tempPassword: 'TempPassword1!',
        name: 'Jane Doe',
      });

      expect(result.success).toBe(false);
      expect(result.fallbackToHandout).toBe(true);
      expect(result.reason).toContain('not configured');
    });

    it('dispatches HTTP Basic Auth request to Twilio API when configured', async () => {
      process.env.TWILIO_SID = 'AC_mock_sid';
      process.env.TWILIO_AUTH_TOKEN = 'mock_secret_token';
      process.env.TWILIO_FROM_NUMBER = '+15550001111';

      axios.post.mockResolvedValueOnce({
        data: { sid: 'SM_test_message_id_123', status: 'queued' },
      });

      const result = await smsService.sendCredentialSMS({
        to: '+15551234567',
        studentId: 'STU-001',
        tempPassword: 'TempPassword1!',
        name: 'Jane Doe',
        collegeName: 'Pacific Coast',
        collegeSlug: 'pacific-coast',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM_test_message_id_123');
      expect(result.fallbackToHandout).toBe(false);

      expect(axios.post).toHaveBeenCalledTimes(1);
      const [url, body, options] = axios.post.mock.calls[0];
      expect(url).toContain('AC_mock_sid/Messages.json');
      expect(body).toContain('To=%2B15551234567');
      expect(body).toContain('From=%2B15550001111');
      expect(body).toContain('STU-001');
      expect(options.headers.Authorization).toContain('Basic ');
    });

    it('falls back to handout if Twilio API returns an error', async () => {
      process.env.TWILIO_SID = 'AC_mock_sid';
      process.env.TWILIO_AUTH_TOKEN = 'mock_secret_token';
      process.env.TWILIO_FROM_NUMBER = '+15550001111';

      axios.post.mockRejectedValueOnce(new Error('Twilio Network Gateway Timeout'));

      const result = await smsService.sendCredentialSMS({
        to: '+15551234567',
        studentId: 'STU-001',
        tempPassword: 'TempPassword1!',
        name: 'Jane Doe',
      });

      expect(result.success).toBe(false);
      expect(result.fallbackToHandout).toBe(true);
      expect(result.error).toContain('Twilio Network Gateway Timeout');
    });
  });

  describe('2. Student Roster Bulk-Upload SMS Delivery & Handout Fallback Flow', () => {
    it('triggers SMS dispatch for phone-only student when Twilio is configured', async () => {
      process.env.TWILIO_SID = 'AC_test_configured';
      process.env.TWILIO_AUTH_TOKEN = 'auth_configured_secret';
      process.env.TWILIO_FROM_NUMBER = '+15558889999';

      axios.post.mockResolvedValueOnce({
        data: { sid: 'SM_bulk_001', status: 'queued' },
      });

      // CSV with phone-only student
      const csvData =
        'StudentId,Name,Phone,Program,Year\n' +
        'STU-PHONE-1,Alex PhoneOnly,+15559876543,Engineering,Year 1\n';

      const validateRes = await request(app)
        .post('/api/admin/students/upload/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csvData), 'roster_phone.csv');

      expect(validateRes.status).toBe(200);
      const batchId = validateRes.body.batchId;
      const validRows = validateRes.body.validRowsPayload;

      // Commit the batch
      const commitRes = await request(app)
        .post('/api/admin/students/upload/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchId, validRows });

      expect(commitRes.status).toBe(202);

      // Wait for background commit processing
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const statusCheck = await request(app)
          .get(`/api/admin/students/upload/${batchId}/status`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (statusCheck.body.batch?.status === 'committed') break;
      }

      // Verify delivery status
      const statusRes = await request(app)
        .get(`/api/admin/students/upload/${batchId}/delivery-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.summary.sms_queued).toBe(1);
      expect(statusRes.body.summary.sent).toBe(1);
      expect(statusRes.body.hasCredentialSlips).toBe(false);

      const studentRecord = await User.findOne({
        collegeId: college._id,
        studentId: 'stu-phone-1',
      });
      expect(studentRecord).toBeTruthy();
      expect(studentRecord.status).toBe('invited');
      expect(studentRecord.phone).toContain('15559876543');
    });

    it('falls back to printed handout when phone-only student uploaded without Twilio credentials', async () => {
      delete process.env.TWILIO_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_FROM_NUMBER;

      const csvData =
        'StudentId,Name,Phone,Program,Year\n' +
        'STU-NO-TWILIO,Bob Offline,+15551112222,Arts,Year 2\n';

      const validateRes = await request(app)
        .post('/api/admin/students/upload/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csvData), 'roster_no_twilio.csv');

      expect(validateRes.status).toBe(200);
      const batchId = validateRes.body.batchId;
      const validRows = validateRes.body.validRowsPayload;

      const commitRes = await request(app)
        .post('/api/admin/students/upload/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchId, validRows });

      expect(commitRes.status).toBe(202);

      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const statusCheck = await request(app)
          .get(`/api/admin/students/upload/${batchId}/status`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (statusCheck.body.batch?.status === 'committed') break;
      }

      const statusRes = await request(app)
        .get(`/api/admin/students/upload/${batchId}/delivery-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.summary.no_contact_info).toBe(1);
      expect(statusRes.body.hasCredentialSlips).toBe(true);

      // Verify printed handout export endpoint returns the slip
      const handoutRes = await request(app)
        .get(`/api/admin/students/upload/${batchId}/handouts`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(handoutRes.status).toBe(200);
      expect(handoutRes.headers['content-type']).toContain('text/csv');
      expect(handoutRes.text).toContain('STU-NO-TWILIO');
      expect(handoutRes.text).toContain('Bob Offline');
      expect(handoutRes.text).toContain('printed_handout');
    });

    it('falls back to printed handout when Twilio dispatch fails for phone-only student', async () => {
      process.env.TWILIO_SID = 'AC_test_configured';
      process.env.TWILIO_AUTH_TOKEN = 'auth_configured_secret';
      process.env.TWILIO_FROM_NUMBER = '+15558889999';

      // Simulate Twilio rejecting dispatch (e.g. invalid handset)
      axios.post.mockRejectedValueOnce({
        response: { data: { message: 'Carrier lookup failed: invalid phone number' } },
      });

      const csvData =
        'StudentId,Name,Phone,Program,Year\n' +
        'STU-FAIL-SMS,Carol Failed,+15559990000,Science,Year 3\n';

      const validateRes = await request(app)
        .post('/api/admin/students/upload/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csvData), 'roster_fail.csv');

      expect(validateRes.status).toBe(200);
      const batchId = validateRes.body.batchId;
      const validRows = validateRes.body.validRowsPayload;

      await request(app)
        .post('/api/admin/students/upload/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchId, validRows });

      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const statusCheck = await request(app)
          .get(`/api/admin/students/upload/${batchId}/status`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (statusCheck.body.batch?.status === 'committed') break;
      }

      const statusRes = await request(app)
        .get(`/api/admin/students/upload/${batchId}/delivery-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.summary.no_contact_info).toBe(1);
      expect(statusRes.body.hasCredentialSlips).toBe(true);

      // Verify printed handout export endpoint returns the slip
      const handoutRes = await request(app)
        .get(`/api/admin/students/upload/${batchId}/handouts`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(handoutRes.status).toBe(200);
      expect(handoutRes.text).toContain('STU-FAIL-SMS');
      expect(handoutRes.text).toContain('Carol Failed');
      expect(handoutRes.text).toContain('printed_handout');
    });
  });
});
