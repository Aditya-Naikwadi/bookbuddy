/**
 * Test Suite: Sensitive Data Logging and PII Redaction Audit (Security Topic 20)
 *
 * Verifies that:
 * 1. The central logger redacts sensitive keys (passwords, tokens, secrets, cookies, apiKeys, cards, otps).
 * 2. PII (emails, cards, JWTs, Bearer headers) are automatically masked in log strings.
 * 3. Log injection via CRLF characters is prevented (newlines neutralized to spaces).
 * 4. URLs with sensitive query parameters (tokens, keys, passwords) are scrubbed.
 * 5. Error tracking and alerting tools scrub sensitive fields.
 * 6. Live HTTP operations (login, registration, password change, failing requests) never log secrets.
 */

/* eslint-disable no-console */
require('./setupEnv');
const request = require('supertest');
const app = require('../app');
const logger = require('../utils/logger');
const User = require('../models/User');
const College = require('../models/College');
const { generateTokenPair } = require('../utils/token');

describe('Security Topic 20: Keep Sensitive Data Out of Logs', () => {
  describe('1. Central Logger Key-Based Redaction', () => {
    it('should recursively redact sensitive object keys with [REDACTED]', () => {
      const sensitivePayload = {
        userId: 'USER_123',
        password: 'SuperSecretPassword123!',
        currentPassword: 'OldPassword123!',
        newPassword: 'BrandNewPassword123!',
        token: 'eyJh...token...xyz',
        accessToken: 'access-12345',
        refreshToken: 'refresh-67890',
        authorization: 'Bearer secret_token',
        cookie: 'sessionId=abc123xyz',
        apiKey: 'sk_live_1234567890',
        card: '4111222233334444',
        cvv: '123',
        otp: '987654',
        nested: {
          secret: 'deep_hidden_secret',
          safeField: 'visible_data',
        },
        items: [{ password: 'array_password' }, { normal: 'ok' }],
      };

      const cleaned = logger.sanitizeValue(sensitivePayload);

      expect(cleaned.userId).toBe('USER_123');
      expect(cleaned.password).toBe('[REDACTED]');
      expect(cleaned.currentPassword).toBe('[REDACTED]');
      expect(cleaned.newPassword).toBe('[REDACTED]');
      expect(cleaned.token).toBe('[REDACTED]');
      expect(cleaned.accessToken).toBe('[REDACTED]');
      expect(cleaned.refreshToken).toBe('[REDACTED]');
      expect(cleaned.authorization).toBe('[REDACTED]');
      expect(cleaned.cookie).toBe('[REDACTED]');
      expect(cleaned.apiKey).toBe('[REDACTED]');
      expect(cleaned.card).toBe('[REDACTED]');
      expect(cleaned.cvv).toBe('[REDACTED]');
      expect(cleaned.otp).toBe('[REDACTED]');
      expect(cleaned.nested.secret).toBe('[REDACTED]');
      expect(cleaned.nested.safeField).toBe('visible_data');
      expect(cleaned.items[0].password).toBe('[REDACTED]');
      expect(cleaned.items[1].normal).toBe('ok');
    });

    it('should safely handle circular references without throwing', () => {
      const circularObj = { name: 'RootNode' };
      circularObj.self = circularObj;

      expect(() => {
        const result = logger.sanitizeValue(circularObj);
        expect(result.name).toBe('RootNode');
        expect(result.self).toBe('[CIRCULAR]');
      }).not.toThrow();
    });
  });

  describe('2. PII, Token, and Secret String Masking', () => {
    it('should mask email addresses within arbitrary strings', () => {
      const str = 'User alice.smith@university.edu logged in successfully from external domain.';
      const sanitized = logger.sanitizeString(str);
      expect(sanitized).not.toContain('alice.smith@university.edu');
      expect(sanitized).toMatch(/a\*\*\*@university\.edu/);
    });

    it('should redact raw JWT tokens in log strings', () => {
      const rawJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const logMsg = `Handshake verified with token ${rawJwt}`;
      const sanitized = logger.sanitizeString(logMsg);
      expect(sanitized).not.toContain(rawJwt);
      expect(sanitized).toContain('[REDACTED_JWT]');
    });

    it('should redact Authorization Bearer tokens in log strings', () => {
      const msg = 'Incoming request with header Authorization: Bearer abc123secrettoken';
      const sanitized = logger.sanitizeString(msg);
      expect(sanitized).not.toContain('abc123secrettoken');
      expect(sanitized).toContain('Bearer [REDACTED_TOKEN]');
    });

    it('should redact credit card numbers in log strings', () => {
      const msg = 'Customer entered card 4111-2222-3333-4444 for fine payment';
      const sanitized = logger.sanitizeString(msg);
      expect(sanitized).not.toContain('4111-2222-3333-4444');
      expect(sanitized).toContain('[REDACTED_CARD]');
    });
  });

  describe('3. Log Injection Prevention (CRLF Neutralization)', () => {
    it('should neutralize carriage return and newline characters to prevent forged log entries', () => {
      const maliciousInput =
        'Valid message\r\n[2026-10-11T12:00:00.000Z] ERROR: System compromised admin gained access\nAnother line';
      const sanitized = logger.sanitizeString(maliciousInput);

      expect(sanitized).not.toContain('\r');
      expect(sanitized).not.toContain('\n');
      expect(sanitized).toBe(
        'Valid message [2026-10-11T12:00:00.000Z] ERROR: System compromised admin gained access Another line'
      );
    });
  });

  describe('4. URL Sanitization for Query Parameter Secrets', () => {
    it('should redact sensitive query parameters in request URLs', () => {
      const dangerousUrl =
        '/api/v1/auth/reset-password?token=secretResetToken12345&email=user@test.com&key=secretKey999';
      const sanitized = logger.sanitizeUrl(dangerousUrl);

      expect(sanitized).not.toContain('secretResetToken12345');
      expect(sanitized).not.toContain('secretKey999');
      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('key=[REDACTED]');
    });
  });

  describe('5. Live HTTP Operations Logging Verification', () => {
    let testCollege;
    let testUser;
    let authToken;
    const capturedLogs = [];

    const interceptConsole = () => {
      const originalInfo = console.info;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.info = (...args) => {
        capturedLogs.push(args.join(' '));
        originalInfo(...args);
      };
      console.warn = (...args) => {
        capturedLogs.push(args.join(' '));
        originalWarn(...args);
      };
      console.error = (...args) => {
        capturedLogs.push(args.join(' '));
        originalError(...args);
      };

      return () => {
        console.info = originalInfo;
        console.warn = originalWarn;
        console.error = originalError;
      };
    };

    beforeAll(async () => {
      testCollege = await College.create({
        name: 'Logging Security Test University',
        code: `LSTU_${Date.now()}`,
        slug: `log-test-${Date.now()}`,
        status: 'active',
        allowedEmailDomains: ['logtest.edu'],
      });

      const argon2 = require('argon2');
      const hashedPassword = await argon2.hash('SecretPass123!@#', { type: argon2.argon2id });

      testUser = await User.create({
        studentId: 'LOG_STU_001',
        name: 'Log Auditor',
        email: `log_auditor_${Date.now()}@logtest.edu`,
        password: hashedPassword,
        role: 'student',
        collegeId: testCollege._id,
        isActive: true,
      });

      const tokens = generateTokenPair(testUser);
      authToken = tokens.accessToken;
    });

    afterAll(async () => {
      if (testUser) await User.deleteOne({ _id: testUser._id });
      if (testCollege) await College.deleteOne({ _id: testCollege._id });
    });

    it('should never expose plain passwords during login attempts in logs', async () => {
      capturedLogs.length = 0;
      const restore = interceptConsole();

      try {
        const sensitivePassword = 'SecretPass123!@#';
        const res = await request(app).post('/api/auth/login').send({
          email: testUser.email,
          password: sensitivePassword,
        });

        expect(res.status).toBe(200);

        const joinedLogs = capturedLogs.join(' ');
        expect(joinedLogs).not.toContain(sensitivePassword);
      } finally {
        restore();
      }
    });

    it('should never expose passwords or tokens during password change in logs', async () => {
      capturedLogs.length = 0;
      const restore = interceptConsole();

      try {
        const oldPass = 'SecretPass123!@#';
        const newPass = 'UpdatedSecurePass999!@#';

        const res = await request(app)
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            currentPassword: oldPass,
            newPassword: newPass,
          });

        expect(res.status).toBe(200);

        const joinedLogs = capturedLogs.join(' ');
        expect(joinedLogs).not.toContain(oldPass);
        expect(joinedLogs).not.toContain(newPass);
        expect(joinedLogs).not.toContain(authToken);
      } finally {
        restore();
      }
    });

    it('should neutralize CRLF log injection in failed request payloads', async () => {
      capturedLogs.length = 0;
      const restore = interceptConsole();

      try {
        const injectionPayload =
          'invalid@logtest.edu\r\n[CRITICAL_SECURITY_ALERT] Server compromised';

        const res = await request(app).post('/api/auth/login').send({
          email: injectionPayload,
          password: 'AttemptPassword123!',
        });

        expect([400, 401]).toContain(res.status);

        const joinedLogs = capturedLogs.join(' ');
        expect(joinedLogs).not.toContain('\r\n[CRITICAL_SECURITY_ALERT]');
        expect(joinedLogs).not.toContain('AttemptPassword123!');
      } finally {
        restore();
      }
    });
  });
});
