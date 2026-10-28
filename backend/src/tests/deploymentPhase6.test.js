const request = require('supertest');
const crypto = require('crypto');
const axios = require('axios');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const SMSDeliveryLog = require('../models/SMSDeliveryLog');
const {
  generateOAuthState,
  verifyOAuthState,
  isSafeReturnUrl,
  consumedNonces,
} = require('../utils/oauthStateHelper');
const { getTransporter, sendEmailWithRetry, isTransientError } = require('../utils/mailer');
const smsService = require('../services/smsService');

jest.mock('axios');

describe('Deployment Phase 6: Integrations (OAuth, SMTP, Indian DLT SMS)', () => {
  let college;
  let testUser;

  beforeAll(async () => {
    college = await College.create({
      name: 'Integration Institute of Technology',
      code: 'IIT-P6',
      slug: 'iit-p6',
      isActive: true,
      status: 'active',
    });

    testUser = await User.create({
      name: 'Phase6 Student',
      email: 'p6student@iit.edu',
      password: 'password123',
      role: 'student',
      studentId: 'STU-P6-001',
      collegeId: college._id,
      isVerified: true,
      status: 'active',
    });
  });

  afterAll(async () => {
    await SMSDeliveryLog.deleteMany({ collegeId: college._id });
    await User.deleteMany({ email: 'p6student@iit.edu' });
    await College.deleteMany({ _id: college._id });
  });

  // =========================================================================
  // Step 34: OAuth Callback Unification, State Signing & Return URL Validation
  // =========================================================================
  describe('1. OAuth State Signing & Open Redirect Protection (Step 34)', () => {
    it('should generate a valid HMAC-signed OAuth state string', () => {
      const state = generateOAuthState({
        collegeId: college._id,
        collegeSlug: college.slug,
        returnUrl: '/dashboard/student',
        provider: 'google',
      });

      expect(typeof state).toBe('string');
      expect(state.split('.').length).toBe(2);

      const verified = verifyOAuthState(state);
      expect(verified.valid).toBe(true);
      expect(verified.payload.collegeId).toBe(college._id.toString());
      expect(verified.payload.collegeSlug).toBe('iit-p6');
      expect(verified.payload.returnUrl).toBe('/dashboard/student');
      expect(verified.payload.provider).toBe('google');
      expect(verified.payload.nonce).toBeDefined();
    });

    it('should reject tampered OAuth state parameter with HMAC mismatch', () => {
      const state = generateOAuthState({
        collegeId: college._id,
        returnUrl: '/dashboard/student',
      });

      const [payload, signature] = state.split('.');
      // Tamper with payload by changing base64 data
      const tamperedPayload = Buffer.from(
        JSON.stringify({ collegeId: 'fake-college-id', returnUrl: '/hacked' })
      ).toString('base64url');

      const tamperedState = `${tamperedPayload}.${signature}`;
      const result = verifyOAuthState(tamperedState);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Invalid OAuth state signature/);
    });

    it('should reject expired OAuth state (>10 minutes TTL)', () => {
      // Create an expired payload
      const payload = {
        collegeId: college._id.toString(),
        returnUrl: '/dashboard',
        nonce: 'expired-nonce-123',
        timestamp: Date.now() - 15 * 60 * 1000, // 15 mins ago
      };

      const secret = process.env.JWT_SECRET || 'testjwtsecretkey999';
      const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('base64url');

      const expiredState = `${payloadString}.${signature}`;
      const result = verifyOAuthState(expiredState);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/OAuth state has expired/);
    });

    it('should prevent replay attacks by rejecting already-consumed nonces', () => {
      const state = generateOAuthState({
        collegeId: college._id,
        returnUrl: '/dashboard',
      });

      // First verification should pass
      const firstCheck = verifyOAuthState(state);
      expect(firstCheck.valid).toBe(true);

      // Replay check of the same state string must be rejected
      const replayCheck = verifyOAuthState(state);
      expect(replayCheck.valid).toBe(false);
      expect(replayCheck.error).toMatch(/OAuth state replay detected/);
    });

    it('should strictly validate safe vs unsafe return URLs (Open Redirect Prevention)', () => {
      // Safe relative paths
      expect(isSafeReturnUrl('/dashboard/student')).toBe(true);
      expect(isSafeReturnUrl('/profile?tab=loans')).toBe(true);

      // Protocol-relative unsafe redirects (attempting //evil.com)
      expect(isSafeReturnUrl('//evil.com')).toBe(false);
      expect(isSafeReturnUrl('//attacker.com/steal')).toBe(false);

      // Dangerous schemes
      expect(isSafeReturnUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeReturnUrl('data:text/html,<script>alert(1)</script>')).toBe(false);

      // Unlisted foreign domain
      expect(isSafeReturnUrl('https://phishing-site.example/login')).toBe(false);

      // Allowed domains
      expect(isSafeReturnUrl('https://bookbuddy.app/catalog')).toBe(true);
      expect(isSafeReturnUrl('https://iit.bookbuddy.app/student')).toBe(true);
      expect(isSafeReturnUrl('http://localhost:5000/oauth-success')).toBe(true);
    });

    it('should reject OAuth callback when state parameter is malformed or invalid', async () => {
      const res = await request(app).get(
        '/api/v1/auth/google/callback?state=invalid.tampered_state'
      );

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid OAuth state signature/);
    });
  });

  // =========================================================================
  // Step 35: Email Delivery Modernization (SMTP Timeout Hardening & Retries)
  // =========================================================================
  describe('2. Email Delivery Modernization & SMTP Retries (Step 35)', () => {
    it('should strictly prohibit insecure SMTP port 25', async () => {
      const prevPort = process.env.SMTP_PORT;
      const prevHost = process.env.SMTP_HOST;
      const prevUser = process.env.SMTP_USER;

      process.env.SMTP_PORT = '25';
      process.env.SMTP_HOST = 'mail.insecure.edu';
      process.env.SMTP_USER = 'insecure_user';

      // Ensure fresh transporter evaluation
      await expect(getTransporter()).rejects.toThrow(/Insecure SMTP port 25 is prohibited/);

      // Restore environment
      if (prevPort) process.env.SMTP_PORT = prevPort;
      else delete process.env.SMTP_PORT;
      if (prevHost) process.env.SMTP_HOST = prevHost;
      else delete process.env.SMTP_HOST;
      if (prevUser) process.env.SMTP_USER = prevUser;
      else delete process.env.SMTP_USER;
    });

    it('should correctly classify transient network/SMTP errors for retry', () => {
      // Transient codes & errors
      expect(isTransientError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(isTransientError({ code: 'ECONNRESET' })).toBe(true);
      expect(isTransientError({ responseCode: 421 })).toBe(true);
      expect(isTransientError({ responseCode: 451 })).toBe(true);
      expect(isTransientError({ message: 'Greeting never received from SMTP server' })).toBe(true);

      // Permanent failures
      expect(isTransientError({ responseCode: 550, message: 'Mailbox unavailable' })).toBe(false);
      expect(isTransientError({ responseCode: 501, message: 'Syntax error' })).toBe(false);
    });

    it('should successfully dispatch email with retry helper when transporter succeeds', async () => {
      const result = await sendEmailWithRetry({
        to: 'student@phase6.edu',
        subject: 'Welcome to BookBuddy',
        text: 'Hello Student',
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });
  });

  // =========================================================================
  // Step 36: SMS Configuration with Indian DLT Compliance & Audit Logging
  // =========================================================================
  describe('3. Indian DLT SMS Compliance & Delivery Logging (Step 36)', () => {
    it('should mask phone numbers according to DLT standards (+91 and international)', () => {
      expect(smsService.maskPhoneNumber('+15551234567')).toBe('+15***4567');
      expect(smsService.maskPhoneNumber('+919876543210')).toBe('+91******3210');
      expect(smsService.maskPhoneNumber('9876543210')).toBe('987***3210');
      expect(smsService.maskPhoneNumber('')).toBe('***');
    });

    it('should maintain standard DLT template identifiers for transactional notices', () => {
      expect(smsService.DLT_TEMPLATES.CREDENTIALS_ONBOARDING).toBeDefined();
      expect(smsService.DLT_TEMPLATES.OVERDUE_ALERT).toBeDefined();
      expect(smsService.DLT_TEMPLATES.RESERVATION_READY).toBeDefined();
      expect(smsService.DLT_TEMPLATES.OTP_VERIFICATION).toBeDefined();
      expect(smsService.DEFAULT_DLT_ENTITY_ID).toBeDefined();
      expect(smsService.DEFAULT_DLT_HEADER).toBe('BKBDDY');
    });

    it('should pass DLT entity ID, template ID, and record SMSDeliveryLog on successful dispatch', async () => {
      const prevSid = process.env.TWILIO_SID;
      const prevToken = process.env.TWILIO_AUTH_TOKEN;
      const prevFrom = process.env.TWILIO_FROM_NUMBER;

      process.env.TWILIO_SID = 'AC_TEST_PHASE6_DLT_SID';
      process.env.TWILIO_AUTH_TOKEN = 'AUTH_TOKEN_TEST_12345';
      process.env.TWILIO_FROM_NUMBER = '+15550001122';

      axios.post.mockResolvedValueOnce({
        status: 201,
        data: {
          sid: 'SM_PHASE6_TEST_SID_001',
          status: 'queued',
        },
      });

      const res = await smsService.sendCredentialSMS({
        to: '+919876543210',
        studentId: 'STU-DLT-100',
        tempPassword: 'TempPassSecret123',
        name: 'Arjun Sharma',
        collegeId: college._id,
        collegeName: 'IIT Phase 6',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe('SM_PHASE6_TEST_SID_001');
      expect(res.fallbackToHandout).toBe(false);

      // Verify parameters sent to SMS endpoint
      expect(axios.post).toHaveBeenCalled();
      const [calledUrl, calledBody] = axios.post.mock.calls[0];
      expect(calledUrl).toContain('/Accounts/AC_TEST_PHASE6_DLT_SID/Messages.json');
      expect(calledBody).toContain('DltEntityId=');
      expect(calledBody).toContain('DltTemplateId=');

      // Verify persistent audit record in SMSDeliveryLog
      const log = await SMSDeliveryLog.findOne({
        providerMessageId: 'SM_PHASE6_TEST_SID_001',
      });
      expect(log).toBeDefined();
      expect(log.recipientPhoneMasked).toBe('+91******3210');
      expect(log.collegeId.toString()).toBe(college._id.toString());
      expect(log.status).toBe('sent');
      expect(log.templateId).toBe(smsService.DLT_TEMPLATES.CREDENTIALS_ONBOARDING);

      // Restore env
      process.env.TWILIO_SID = prevSid;
      process.env.TWILIO_AUTH_TOKEN = prevToken;
      process.env.TWILIO_FROM_NUMBER = prevFrom;
    });

    it('should log failed SMS delivery in SMSDeliveryLog and fallback to handout without crashing', async () => {
      const prevSid = process.env.TWILIO_SID;
      const prevToken = process.env.TWILIO_AUTH_TOKEN;
      const prevFrom = process.env.TWILIO_FROM_NUMBER;

      process.env.TWILIO_SID = 'AC_TEST_PHASE6_DLT_SID';
      process.env.TWILIO_AUTH_TOKEN = 'AUTH_TOKEN_TEST_12345';
      process.env.TWILIO_FROM_NUMBER = '+15550001122';

      axios.post.mockRejectedValueOnce(new Error('DLT Template ID mismatch rejected by carrier'));

      const res = await smsService.sendCredentialSMS({
        to: '+919876543210',
        studentId: 'STU-DLT-FAIL',
        tempPassword: 'SecretPassword999',
        name: 'Failed Delivery Patron',
        collegeId: college._id,
      });

      expect(res.success).toBe(false);
      expect(res.fallbackToHandout).toBe(true);
      expect(res.error).toMatch(/DLT Template ID mismatch/);

      // Verify failure logged in database
      const failedLog = await SMSDeliveryLog.findOne({
        recipientPhoneMasked: '+91******3210',
        status: 'failed',
      }).sort({ createdAt: -1 });

      expect(failedLog).toBeDefined();
      expect(failedLog.errorMessage).toMatch(/DLT Template ID mismatch/);

      // Restore env
      process.env.TWILIO_SID = prevSid;
      process.env.TWILIO_AUTH_TOKEN = prevToken;
      process.env.TWILIO_FROM_NUMBER = prevFrom;
    });
  });
});
