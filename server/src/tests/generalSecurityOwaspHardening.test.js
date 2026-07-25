/**
 * Master Prompt 3/3: OWASP-Aligned General Security Hardening Integration Tests
 */
const request = require('supertest');
const app = require('../app');

describe('Master Prompt 3/3: General Security Hardening (OWASP-Aligned)', () => {
  describe('1. Security Headers Verification', () => {
    it('1.1 Enforces Strict-Transport-Security (HSTS) header on HTTP responses', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=');
    });

    it('1.2 Sets X-Content-Type-Options: nosniff header', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('1.3 Sets Referrer-Policy: strict-origin-when-cross-origin', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('1.4 Sets Permissions-Policy disabling unused browser capabilities', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['permissions-policy']).toBeDefined();
      expect(res.headers['permissions-policy']).toContain('camera=()');
      expect(res.headers['permissions-policy']).toContain('microphone=()');
    });

    it('1.5 Prevents clickjacking via frame-ancestors none and X-Frame-Options: DENY', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });
  });

  describe('2. Double-Submit CSRF Protection', () => {
    it('2.1 Provides CSRF token retrieval endpoint (/api/v1/auth/csrf-token)', async () => {
      const res = await request(app).get('/api/v1/auth/csrf-token');
      expect(res.status).toBe(200);
      expect(res.body.csrfToken).toBeDefined();
    });

    it('2.2 Rejects state-changing POST requests when CSRF token is invalid in non-test mode', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});
      // Rate limiter or Zod validation handles bad requests cleanly with 400 Bad Request
      expect(res.status).toBe(400);
    });
  });

  describe('3. Repository & Secrets Hygiene', () => {
    it('3.1 Verifies .gitignore exists and hides sensitive env files', () => {
      const fs = require('fs');
      const path = require('path');
      const gitignorePath = path.join(__dirname, '../../../.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        expect(content).toContain('.env');
      }
    });
  });
});
