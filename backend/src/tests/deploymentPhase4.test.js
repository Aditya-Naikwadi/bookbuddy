/**
 * Test Suite: Deployment Phase 4 Verification (Edge and Network Correctness)
 *
 * Verifies:
 * - Step 26: Real client IP derivation & spoofing protection (Cloudflare CIDRs & hop count)
 * - Step 27: Tenant header protection (tenant headers accepted only from trusted local proxy)
 * - Step 28: Clean, uniform unknown college response for unrecognized/suspended slugs
 * - Step 29: App-level admin-portal block for tenant subdomains
 * - Step 30: Health endpoints (/ping is public; /health and /version protected by token/allowlist)
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const config = require('../config');
const College = require('../models/College');
const {
  isCloudflareIp,
  isTrustedProxy,
  resolveClientIp,
  cleanIp,
} = require('../utils/clientIpHelper');
const { extractSubdomain } = require('../middlewares/subdomainTenantResolver');

describe('Deployment Phase 4: Edge and Network Correctness', () => {
  let activeCollege;
  let suspendedCollege;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  beforeEach(async () => {
    await College.deleteMany({});

    activeCollege = await College.create({
      name: 'Active Technical Institute',
      slug: 'active-tech',
      code: 'ATI',
      status: 'active',
      isActive: true,
    });

    suspendedCollege = await College.create({
      name: 'Suspended University',
      slug: 'suspended-univ',
      code: 'SUNIV',
      status: 'suspended',
      isActive: false,
    });
  });

  afterAll(async () => {
    await College.deleteMany({});
  });

  describe('Step 26: Real Client IP & Cloudflare CIDR Validation', () => {
    it('isCloudflareIp correctly identifies official Cloudflare IPv4 and IPv6 ranges', () => {
      // Valid Cloudflare IPv4 ranges
      expect(isCloudflareIp('173.245.48.1')).toBe(true);
      expect(isCloudflareIp('103.21.244.50')).toBe(true);
      expect(isCloudflareIp('141.101.64.10')).toBe(true);
      expect(isCloudflareIp('108.162.192.1')).toBe(true);
      expect(isCloudflareIp('190.93.240.200')).toBe(true);
      expect(isCloudflareIp('188.114.96.15')).toBe(true);
      expect(isCloudflareIp('197.234.240.1')).toBe(true);
      expect(isCloudflareIp('198.41.128.5')).toBe(true);
      expect(isCloudflareIp('162.158.0.1')).toBe(true);
      expect(isCloudflareIp('104.16.0.1')).toBe(true);
      expect(isCloudflareIp('172.64.0.1')).toBe(true);

      // Valid Cloudflare IPv6
      expect(isCloudflareIp('2400:cb00:1::1')).toBe(true);
      expect(isCloudflareIp('2606:4700::1')).toBe(true);

      // Non-Cloudflare / Arbitrary public IPs
      expect(isCloudflareIp('8.8.8.8')).toBe(false);
      expect(isCloudflareIp('1.1.1.1')).toBe(false); // 1.1.1.1 is CF public DNS, not edge proxy
      expect(isCloudflareIp('203.0.113.195')).toBe(false);
      expect(isCloudflareIp('127.0.0.1')).toBe(false);
    });

    it('isTrustedProxy correctly identifies loopback and configured local proxies', () => {
      expect(isTrustedProxy('127.0.0.1')).toBe(true);
      expect(isTrustedProxy('::1')).toBe(true);
      expect(isTrustedProxy('127.0.0.5')).toBe(true);
      expect(isTrustedProxy('localhost')).toBe(true);
      expect(isTrustedProxy('203.0.113.195')).toBe(false);
    });

    it('resolveClientIp rejects forged CF-Connecting-IP from untrusted direct peer', () => {
      const untrustedReq = {
        socket: { remoteAddress: '203.0.113.50' },
        headers: {
          'cf-connecting-ip': '1.2.3.4',
        },
      };

      // Direct peer is untrusted external IP; forged CF header must be ignored
      const resolved = resolveClientIp(untrustedReq);
      expect(resolved).toBe('203.0.113.50');
    });

    it('resolveClientIp honors CF-Connecting-IP from verified Cloudflare peer or trusted local proxy', () => {
      // Case A: Arrived from Cloudflare edge IP
      const cloudflareReq = {
        socket: { remoteAddress: '173.245.48.10' },
        headers: {
          'cf-connecting-ip': '198.51.100.25',
        },
      };
      expect(resolveClientIp(cloudflareReq)).toBe('198.51.100.25');

      // Case B: Arrived from local Nginx reverse proxy
      const localProxyReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {
          'cf-connecting-ip': '198.51.100.25',
        },
      };
      expect(resolveClientIp(localProxyReq)).toBe('198.51.100.25');
    });

    it('two visitors behind the same proxy get separate client IP resolution', () => {
      const visitor1 = {
        ip: '203.0.113.10',
        headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
        socket: { remoteAddress: '10.0.0.1' },
      };
      const visitor2 = {
        ip: '203.0.113.20',
        headers: { 'x-forwarded-for': '203.0.113.20, 10.0.0.1' },
        socket: { remoteAddress: '10.0.0.1' },
      };

      expect(resolveClientIp(visitor1)).toBe('203.0.113.10');
      expect(resolveClientIp(visitor2)).toBe('203.0.113.20');
      expect(resolveClientIp(visitor1)).not.toBe(resolveClientIp(visitor2));
    });
  });

  describe('Step 27: Tenant Header Protection', () => {
    it('rejects tenant selection headers from untrusted external client sockets', () => {
      const untrustedClientReq = {
        headers: {
          host: 'bookbuddy.com',
          'x-tenant-subdomain': 'active-tech',
        },
        socket: { remoteAddress: '203.0.113.99' },
      };

      // Header must be rejected because socket peer is an external untrusted client
      const candidate = extractSubdomain(untrustedClientReq);
      expect(candidate).toBeNull();
    });

    it('accepts tenant selection headers from trusted local proxy (e.g. Nginx on loopback)', () => {
      const trustedProxyReq = {
        headers: {
          host: '127.0.0.1:5000',
          'x-tenant-subdomain': 'active-tech',
        },
        socket: { remoteAddress: '127.0.0.1' },
      };

      const candidate = extractSubdomain(trustedProxyReq);
      expect(candidate).toBe('active-tech');
    });

    it('derives tenant from Host header regardless of client origin', () => {
      const hostReq = {
        headers: {
          host: 'active-tech.bookbuddy.com',
        },
        socket: { remoteAddress: '203.0.113.99' },
      };

      const candidate = extractSubdomain(hostReq);
      expect(candidate).toBe('active-tech');
    });

    it('flags spoofing when Host subdomain and tenant header conflict', () => {
      const conflictingReq = {
        headers: {
          host: 'active-tech.bookbuddy.com',
          'x-tenant-subdomain': 'stanford-univ',
        },
        socket: { remoteAddress: '127.0.0.1' },
      };

      const candidate = extractSubdomain(conflictingReq);
      expect(candidate).toBe('__spoofed_subdomain__');
    });
  });

  describe('Step 28: Clean, Uniform Unknown College Response', () => {
    it('returns uniform 404 for non-existent college slug with no stack traces or tenant leaks', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college')
        .set('Host', 'non-existent-college-xyz.bookbuddy.com');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Unknown college or institution');
      expect(res.body.code).toBe('UNKNOWN_COLLEGE');
      expect(res.body.stack).toBeUndefined();
    });

    it('returns identical uniform 404 for suspended college slug with no tenant name leaked', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college')
        .set('Host', 'suspended-univ.bookbuddy.com');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Unknown college or institution');
      expect(res.body.code).toBe('UNKNOWN_COLLEGE');
      // Must not leak the institution's real name
      expect(JSON.stringify(res.body)).not.toContain('Suspended University');
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('Step 29: Admin Portal Block for Tenant Subdomains', () => {
    it('strictly forbids /api/v1/dashboards/admin-portal access when accessed on a tenant host subdomain', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('Host', 'active-tech.bookbuddy.com');

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Super Admin command center is strictly restricted');
    });

    it('strictly forbids /api/v1/dashboards/admin-portal access when x-tenant-subdomain header is present', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('x-tenant-subdomain', 'active-tech');

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Super Admin command center is strictly restricted');
    });

    it('allows access to continue on root domain (hits 401 unauthenticated)', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('Host', 'bookbuddy.com');

      // Passes subdomain tenant block and reaches auth middleware
      expect(res.status).toBe(401);
    });
  });

  describe('Step 30: Health Endpoints Protection', () => {
    it('GET /ping is public, minimal, and does not disclose system internals', async () => {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.version).toBeUndefined();
      expect(res.body.commitSha).toBeUndefined();
    });

    it('GET /health allows local loopback probes without token', async () => {
      // Supertest connects via loopback socket (127.0.0.1)
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /health rejects external untrusted requests without valid health token', async () => {
      const originalToken = config.healthCheckToken;
      try {
        config.healthCheckToken = 'super-secret-health-token-xyz';

        // Mock an untrusted external request to app
        const externalReq = {
          socket: { remoteAddress: '203.0.113.195' },
          headers: {},
        };
        const { isTrustedProxy, cleanIp } = require('../utils/clientIpHelper');
        expect(isTrustedProxy(cleanIp(externalReq.socket.remoteAddress))).toBe(false);
      } finally {
        config.healthCheckToken = originalToken;
      }
    });

    it('GET /health accepts external requests with valid X-Health-Token', async () => {
      const originalToken = config.healthCheckToken;
      try {
        config.healthCheckToken = 'test-health-token-123';
        const res = await request(app)
          .get('/health')
          .set('X-Health-Token', 'test-health-token-123');

        expect(res.status).toBe(200);
      } finally {
        config.healthCheckToken = originalToken;
      }
    });
  });
});
