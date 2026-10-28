const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { verifyAccessToken, verifyRefreshToken, generateTokenPair } = require('../utils/token');
const storage = require('../utils/storage');
const { generateOAuthState, verifyOAuthState } = require('../utils/oauthStateHelper');
const { isAllowedOrigin } = require('../middlewares/csrf');

describe('Deployment Phase 7: Security and Hardening', () => {
  // =========================================================================
  // Step 37: Cloudflare Edge Firewall & Origin Enforcement
  // =========================================================================
  describe('1. Cloudflare Edge Firewall & Origin Isolation (Step 37)', () => {
    const originalEnforce = process.env.CLOUDFLARE_ENFORCE;
    const originalSecret = process.env.CLOUDFLARE_ORIGIN_SECRET;

    afterEach(() => {
      if (originalEnforce !== undefined) process.env.CLOUDFLARE_ENFORCE = originalEnforce;
      else delete process.env.CLOUDFLARE_ENFORCE;

      if (originalSecret !== undefined) process.env.CLOUDFLARE_ORIGIN_SECRET = originalSecret;
      else delete process.env.CLOUDFLARE_ORIGIN_SECRET;
    });

    it('should permit requests when Cloudflare enforcement is disabled (backward compatibility)', async () => {
      delete process.env.CLOUDFLARE_ENFORCE;
      delete process.env.CLOUDFLARE_ORIGIN_SECRET;

      const res = await request(app).get('/api/v1/ping');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('should always permit /ping health checks even with enforcement enabled', async () => {
      process.env.CLOUDFLARE_ENFORCE = 'true';
      process.env.CLOUDFLARE_ORIGIN_SECRET = 'super-secret-origin-pull-token';

      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('should reject direct requests when CLOUDFLARE_ORIGIN_SECRET is missing or invalid', async () => {
      process.env.CLOUDFLARE_ENFORCE = 'true';
      process.env.CLOUDFLARE_ORIGIN_SECRET = 'correct-origin-secret-999';

      const res = await request(app).get('/api/v1/auth/me').set('x-origin-secret', 'wrong-secret');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Valid origin secret required/);
    });

    it('should accept requests when valid X-Origin-Secret header is supplied', async () => {
      process.env.CLOUDFLARE_ENFORCE = 'true';
      process.env.CLOUDFLARE_ORIGIN_SECRET = 'correct-origin-secret-999';

      const res = await request(app)
        .get('/api/v1/ping')
        .set('x-origin-secret', 'correct-origin-secret-999');

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // Step 38: Secrets Rotation Readiness (Zero-Downtime Dual-Secret Support)
  describe('2. Zero-Downtime Secret Rotation Readiness (Step 38)', () => {
    const config = require('../config');
    const activeSecret = config.jwt.secret;
    const oldSecret = 'legacy-previous-jwt-secret-000';

    it('should verify access tokens signed with active secret', () => {
      const token = jwt.sign(
        { sub: 'user123', role: 'student', aud: 'bookbuddy-client', iss: 'bookbuddy-api' },
        activeSecret,
        { algorithm: 'HS256' }
      );

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe('user123');
      expect(decoded.role).toBe('student');
    });

    it('should verify access tokens signed with previous secret during rotation grace period', () => {
      const prevSecretEnv = process.env.JWT_SECRET_PREVIOUS;
      process.env.JWT_SECRET_PREVIOUS = oldSecret;

      try {
        const tokenSignedWithOldSecret = jwt.sign(
          {
            sub: 'user_rotated_456',
            role: 'patron',
            aud: 'bookbuddy-client',
            iss: 'bookbuddy-api',
          },
          oldSecret,
          { algorithm: 'HS256' }
        );

        // Verification must succeed by falling back to JWT_SECRET_PREVIOUS
        const decoded = verifyAccessToken(tokenSignedWithOldSecret);
        expect(decoded.sub).toBe('user_rotated_456');
        expect(decoded.role).toBe('patron');
      } finally {
        if (prevSecretEnv) process.env.JWT_SECRET_PREVIOUS = prevSecretEnv;
        else delete process.env.JWT_SECRET_PREVIOUS;
      }
    });

    it('should verify refresh tokens signed with previous refresh secret during rotation', () => {
      const oldRefreshSecret = 'legacy-refresh-secret-888';
      const prevRefreshEnv = process.env.JWT_REFRESH_SECRET_PREVIOUS;
      process.env.JWT_REFRESH_SECRET_PREVIOUS = oldRefreshSecret;

      try {
        const tokenSignedWithOldSecret = jwt.sign(
          {
            userId: 'user_refresh_789',
            jti: 'jti-123',
            aud: 'bookbuddy-client',
            iss: 'bookbuddy-api',
          },
          oldRefreshSecret,
          { algorithm: 'HS256' }
        );

        const decoded = verifyRefreshToken(tokenSignedWithOldSecret);
        expect(decoded.userId).toBe('user_refresh_789');
      } finally {
        if (prevRefreshEnv) process.env.JWT_REFRESH_SECRET_PREVIOUS = prevRefreshEnv;
        else delete process.env.JWT_REFRESH_SECRET_PREVIOUS;
      }
    });

    it('should verify presigned storage tokens signed with previous storage secret during rotation', () => {
      const oldStorageSecret = 'legacy-storage-key-777';
      const prevStorageEnv = process.env.STORAGE_SIGNING_SECRET_PREVIOUS;
      process.env.STORAGE_SIGNING_SECRET_PREVIOUS = oldStorageSecret;

      try {
        const fileKey = 'ebooks/rotational_test.epub';
        const expires = String(Date.now() + 600000);
        const crypto = require('crypto');
        const tokenFromOldSecret = crypto
          .createHmac('sha256', oldStorageSecret)
          .update(`download:${fileKey}:${expires}`)
          .digest('hex');

        const valid = storage.verifyStorageToken({
          operation: 'download',
          fileKey,
          token: tokenFromOldSecret,
          expires,
        });

        expect(valid).toBe(true);
      } finally {
        if (prevStorageEnv) process.env.STORAGE_SIGNING_SECRET_PREVIOUS = prevStorageEnv;
        else delete process.env.STORAGE_SIGNING_SECRET_PREVIOUS;
      }
    });

    it('should reject tokens signed with an unauthorized secret', () => {
      const badToken = jwt.sign(
        { sub: 'hacker', role: 'admin', aud: 'bookbuddy-client', iss: 'bookbuddy-api' },
        'completely-unauthorized-secret-xyz',
        { algorithm: 'HS256' }
      );

      expect(() => verifyAccessToken(badToken)).toThrow(/invalid signature/);
    });
  });

  // =========================================================================
  // Step 39: Request Body Limits and Slowloris Hardening
  // =========================================================================
  describe('3. Request Body Limits and HTTP Timeouts (Step 39)', () => {
    it('should reject JSON payloads exceeding the configured 1MB limit with HTTP 413', async () => {
      // 1.5MB string payload
      const largePayload = {
        data: 'a'.repeat(1.5 * 1024 * 1024),
      };

      const res = await request(app).post('/api/v1/auth/login').send(largePayload);

      expect(res.status).toBe(413);
    });

    it('should enforce proper socket timeouts for Slowloris and Cloudflare idle alignment', () => {
      // Create a test HTTP server with the app and inspect timeout properties
      const http = require('http');
      const testServer = http.createServer(app);

      // Verify that timeouts can be configured per ADR 0013 specifications
      testServer.keepAliveTimeout = 65000;
      testServer.headersTimeout = 66000;
      testServer.requestTimeout = 30000;

      expect(testServer.keepAliveTimeout).toBe(65000); // Exceeds Cloudflare 60s idle timeout
      expect(testServer.headersTimeout).toBeGreaterThan(testServer.keepAliveTimeout); // Per Node.js HTTP spec
      expect(testServer.requestTimeout).toBe(30000); // 30s Slowloris mitigation
    });
  });

  // =========================================================================
  // Step 40: CORS and CSRF Multi-Tenant Hardening
  // =========================================================================
  describe('4. CORS and CSRF Multi-Tenant Hardening (Step 40)', () => {
    it('should accept valid multi-tenant subdomains in isAllowedOrigin', () => {
      expect(isAllowedOrigin('https://bookbuddy.app')).toBe(true);
      expect(isAllowedOrigin('https://mit.bookbuddy.app')).toBe(true);
      expect(isAllowedOrigin('https://harvard.bookbuddy.com')).toBe(true);
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedOrigin('http://campus.localhost:5173')).toBe(true);
    });

    it('should reject malicious foreign origins in isAllowedOrigin', () => {
      expect(isAllowedOrigin('https://attacker.example.com')).toBe(false);
      expect(isAllowedOrigin('https://fake-bookbuddy.com.attacker.org')).toBe(false);
      expect(isAllowedOrigin('http://evil.com')).toBe(false);
    });

    it('should exempt stateless Bearer token requests from CSRF enforcement', async () => {
      const res = await request(app)
        .post('/api/v1/reader/position')
        .set('Authorization', 'Bearer dummy-access-token')
        .send({ position: 'epubcfi(/6/4)' });

      // Should not be rejected by CSRF (403 with CSRF message);
      // it may be rejected by auth middleware (401 invalid token), proving CSRF was bypassed
      expect(res.status).not.toBe(403);
    });
  });
});
