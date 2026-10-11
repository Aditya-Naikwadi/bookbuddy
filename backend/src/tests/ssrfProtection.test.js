/**
 * Test Suite: Server-Side Request Forgery (SSRF) Protection Audit
 *
 * Verifies that:
 * 1. Disallowed protocols (http, ftp, file, gopher) are rejected (HTTPS enforced).
 * 2. Loopback addresses (127.0.0.1, 127.0.0.0/8, localhost, [::1]) are blocked.
 * 3. Cloud metadata addresses (169.254.169.254, 169.254.0.0/16, metadata.google.internal) are blocked.
 * 4. Private CIDR blocks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 0.0.0.0/8) are blocked.
 * 5. Decimal, octal, hex, and IPv4-mapped IPv6 encodings (e.g., 2130706433, 0x7f000001, ::ffff:127.0.0.1) are detected and blocked.
 * 6. IPv6 ULA (fc00::/7) and link-local (fe80::/10) ranges are blocked.
 * 7. Domain allowlist is strictly enforced.
 * 8. DNS rebinding and resolving to internal IPs are blocked.
 * 9. Upstream redirects to internal addresses are intercepted and blocked on every hop.
 * 10. Endpoints (GET /api/v1/eresources/:id/content & GET /api/v1/reader/:resourceId/content)
 *     strictly enforce SSRF protection and never disclose internal error details.
 */

require('./setupEnv');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const EResource = require('../models/EResource');
const { generateTokenPair } = require('../utils/token');
const {
  parseIPv4,
  isBlockedIPv4,
  parseIPv6,
  isBlockedIPv6,
  isBlockedIp,
  isDomainAllowed,
  validateSafeUrl,
  safeFetch,
} = require('../utils/ssrfValidator');

describe('SSRF Protection Security Suite', () => {
  let authToken;
  let testCollege;
  let testUser;

  beforeAll(async () => {
    const unique = Date.now();
    testCollege = await College.create({
      name: `SSRF College ${unique}`,
      shortName: `SC${unique.toString().slice(-4)}`,
      code: `SC${unique.toString().slice(-4)}`,
      domain: `ssrf${unique}.edu`,
      isActive: true,
    });

    testUser = await User.create({
      name: 'SSRF Student',
      email: `ssrf_tester_${unique}@ssrf${unique}.edu`,
      password: 'StrongPassword123!',
      studentId: `ssrf_std_${unique}`,
      role: 'student',
      collegeId: testCollege._id,
      isActive: true,
    });

    const tokens = generateTokenPair(testUser);
    authToken = tokens.accessToken;
  });

  afterAll(async () => {
    await User.deleteMany({ collegeId: testCollege._id });
    await EResource.deleteMany({ collegeId: testCollege._id });
    await College.findByIdAndDelete(testCollege._id);
  });

  describe('1. Low-Level IP & Subnet Blocking Verification', () => {
    it('blocks loopback IPv4 addresses (127.0.0.1, 127.0.1.1, 127.255.255.254)', () => {
      expect(isBlockedIp('127.0.0.1')).toBe(true);
      expect(isBlockedIp('127.0.1.1')).toBe(true);
      expect(isBlockedIp('127.255.255.254')).toBe(true);
    });

    it('blocks cloud metadata address 169.254.169.254 and link-local range 169.254.0.0/16', () => {
      expect(isBlockedIp('169.254.169.254')).toBe(true);
      expect(isBlockedIp('169.254.1.1')).toBe(true);
    });

    it('blocks RFC 1918 private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)', () => {
      expect(isBlockedIp('10.0.0.1')).toBe(true);
      expect(isBlockedIp('10.254.0.1')).toBe(true);
      expect(isBlockedIp('172.16.0.1')).toBe(true);
      expect(isBlockedIp('172.31.255.254')).toBe(true);
      expect(isBlockedIp('192.168.0.1')).toBe(true);
      expect(isBlockedIp('192.168.1.100')).toBe(true);
    });

    it('blocks 0.0.0.0 and broadcast 255.255.255.255', () => {
      expect(isBlockedIp('0.0.0.0')).toBe(true);
      expect(isBlockedIp('255.255.255.255')).toBe(true);
    });

    it('blocks decimal-encoded IPv4 representations (e.g. 2130706433 for 127.0.0.1)', () => {
      // 2130706433 is 127.0.0.1 in decimal notation
      const parsed = parseIPv4('2130706433');
      expect(parsed).toBe(2130706433);
      expect(isBlockedIPv4(parsed)).toBe(true);
      expect(isBlockedIp('2130706433')).toBe(true);

      // 2852039166 is 169.254.169.254 in decimal notation
      const metaParsed = parseIPv4('2852039166');
      expect(metaParsed).toBe(2852039166);
      expect(isBlockedIPv4(metaParsed)).toBe(true);
      expect(isBlockedIp('2852039166')).toBe(true);
    });

    it('blocks hex and octal-encoded IPv4 representations', () => {
      // 0x7f000001 = 127.0.0.1
      expect(isBlockedIp('0x7f000001')).toBe(true);
      // 0177.0.0.1 = 127.0.0.1 in octal
      expect(isBlockedIp('0177.0.0.1')).toBe(true);
    });

    it('blocks IPv6 loopback (::1, [::1]) and unspecified (::)', () => {
      expect(isBlockedIp('::1')).toBe(true);
      expect(isBlockedIp('[::1]')).toBe(true);
      expect(isBlockedIp('::')).toBe(true);
    });

    it('blocks IPv6 link-local (fe80::/10) and unique local private (fc00::/7)', () => {
      expect(isBlockedIp('fe80::1')).toBe(true);
      expect(isBlockedIp('fe80::a00:27ff:fe8e:7b2f')).toBe(true);
      expect(isBlockedIp('fc00::1')).toBe(true);
      expect(isBlockedIp('fd12:3456:789a::1')).toBe(true);
    });

    it('blocks IPv4-mapped IPv6 addresses (::ffff:127.0.0.1, ::ffff:169.254.169.254)', () => {
      expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
      expect(isBlockedIp('::ffff:169.254.169.254')).toBe(true);
      expect(isBlockedIp('::ffff:10.0.0.1')).toBe(true);
      expect(isBlockedIp('::ffff:192.168.1.1')).toBe(true);
    });

    it('allows valid public routable IP addresses', () => {
      expect(isBlockedIp('8.8.8.8')).toBe(false);
      expect(isBlockedIp('1.1.1.1')).toBe(false);
      expect(isBlockedIp('93.184.216.34')).toBe(false); // example.com
      expect(isBlockedIp('2606:4700:4700::1111')).toBe(false); // Cloudflare IPv6
    });
  });

  describe('2. validateSafeUrl Rule Enforcement', () => {
    it('blocks http://127.0.0.1 (disallowed http protocol and loopback IP)', async () => {
      await expect(validateSafeUrl('http://127.0.0.1')).rejects.toThrow(
        /Only secure HTTPS requests are permitted/i
      );
    });

    it('blocks https://127.0.0.1 (loopback IP)', async () => {
      await expect(validateSafeUrl('https://127.0.0.1')).rejects.toThrow(
        /Direct requests to private, loopback, or metadata IP ranges are blocked/i
      );
    });

    it('blocks http://localhost and https://localhost', async () => {
      await expect(validateSafeUrl('http://localhost')).rejects.toThrow();
      await expect(validateSafeUrl('https://localhost')).rejects.toThrow(
        /Access to local or internal loopback destinations is forbidden/i
      );
    });

    it('blocks http://169.254.169.254/ and https://169.254.169.254/latest/meta-data/', async () => {
      await expect(validateSafeUrl('http://169.254.169.254/')).rejects.toThrow();
      await expect(validateSafeUrl('https://169.254.169.254/latest/meta-data/')).rejects.toThrow(
        /Direct requests to private, loopback, or metadata IP ranges are blocked/i
      );
    });

    it('blocks http://[::1] and https://[::1]', async () => {
      await expect(validateSafeUrl('http://[::1]')).rejects.toThrow();
      await expect(validateSafeUrl('https://[::1]')).rejects.toThrow(
        /Direct requests to private, loopback, or metadata IPv6 ranges are blocked/i
      );
    });

    it('blocks decimal-encoded IP (e.g. http://2130706433 and https://2130706433)', async () => {
      await expect(validateSafeUrl('http://2130706433')).rejects.toThrow();
      await expect(validateSafeUrl('https://2130706433')).rejects.toThrow(
        /Direct requests to private, loopback, or metadata IP ranges are blocked/i
      );
    });

    it('blocks decimal-encoded metadata IP (e.g. https://2852039166)', async () => {
      await expect(validateSafeUrl('https://2852039166')).rejects.toThrow(
        /Direct requests to private, loopback, or metadata IP ranges are blocked/i
      );
    });

    it('blocks host that resolves via DNS to a private IP (DNS rebinding / split-horizon)', async () => {
      const mockDnsLookup = jest.fn().mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
      await expect(
        validateSafeUrl('https://evil-rebind.internal.test/file.epub', {
          dnsLookup: mockDnsLookup,
        })
      ).rejects.toThrow(
        /Destination host resolved to a prohibited private, loopback, or metadata address/i
      );
    });

    it('blocks host that resolves via DNS to 169.254.169.254', async () => {
      const mockDnsLookup = jest
        .fn()
        .mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
      await expect(
        validateSafeUrl('https://cloud-metadata-spoof.test/meta', {
          dnsLookup: mockDnsLookup,
        })
      ).rejects.toThrow(
        /Destination host resolved to a prohibited private, loopback, or metadata address/i
      );
    });

    it('enforces domain allowlist strictly when configured', async () => {
      const mockDnsLookup = jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      const allowedDomains = ['*.gutenberg.org', 'gutenberg.org', 'gutendex.com'];

      // Disallowed domain
      await expect(
        validateSafeUrl('https://malicious-site.com/book.epub', {
          allowedDomains,
          dnsLookup: mockDnsLookup,
        })
      ).rejects.toThrow(/Requested destination domain is not on the permitted access allowlist/i);

      // Allowed domain with valid public IP
      const result = await validateSafeUrl('https://www.gutenberg.org/ebooks/123.epub', {
        allowedDomains,
        dnsLookup: mockDnsLookup,
      });
      expect(result.isSafe).toBe(true);
      expect(result.hostname).toBe('www.gutenberg.org');
    });
  });

  describe('3. safeFetch Redirect & Stream Hardening', () => {
    it('blocks a public URL that redirects to an internal address (e.g. http://127.0.0.1)', async () => {
      const mockAxios = jest.fn().mockResolvedValueOnce({
        status: 302,
        headers: { location: 'http://127.0.0.1:8080/internal' },
        data: null,
      });

      const mockDnsLookup = jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

      await expect(
        safeFetch('https://www.gutenberg.org/redirect-trap', {
          allowedDomains: ['*.gutenberg.org', 'gutenberg.org'],
          dnsLookup: mockDnsLookup,
          axiosClient: mockAxios,
        })
      ).rejects.toThrow(/Only secure HTTPS requests are permitted/i);
    });

    it('blocks a public URL that redirects to 169.254.169.254 or decimal IP', async () => {
      const mockAxios = jest.fn().mockResolvedValueOnce({
        status: 302,
        headers: { location: 'https://169.254.169.254/latest/meta-data/' },
        data: null,
      });

      const mockDnsLookup = jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

      await expect(
        safeFetch('https://www.gutenberg.org/redirect-metadata', {
          allowedDomains: ['*.gutenberg.org', 'gutenberg.org'],
          dnsLookup: mockDnsLookup,
          axiosClient: mockAxios,
        })
      ).rejects.toThrow(/Direct requests to private, loopback, or metadata IP ranges are blocked/i);
    });
  });

  describe('4. Controller & Endpoint SSRF Protection Integration', () => {
    let internalResource;

    beforeEach(async () => {
      internalResource = await EResource.create({
        collegeId: testCollege._id,
        title: 'SSRF Attack Vector EBook',
        author: 'Security Tester',
        category: 'Test',
        type: 'epub',
        fileUrl: 'https://gutenberg.org/safe.epub',
        source: 'gutenberg',
        uploadedBy: testUser._id,
        readUrl: 'http://127.0.0.1:8080/secret.txt',
        epubUrl: 'http://169.254.169.254/latest/meta-data/',
        isPublished: true,
        moderationStatus: 'approved',
      });
    });

    afterEach(async () => {
      if (internalResource) {
        await EResource.findByIdAndDelete(internalResource._id);
      }
    });

    it('rejects proxyContent when resource readUrl points to http://127.0.0.1 (400/403/502)', async () => {
      const res = await request(app)
        .get(`/api/v1/eresources/external/${internalResource._id}/content?format=html`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 403, 502]).toContain(res.status);
      expect(res.body.success).toBe(false);
      // Ensure zero internal error details or internal IPs are disclosed to the client
      expect(res.body.message).not.toContain('127.0.0.1');
      expect(res.body.message).not.toContain('ECONNREFUSED');
    });

    it('rejects proxyContent when resource epubUrl points to http://169.254.169.254 (400/403/502)', async () => {
      const res = await request(app)
        .get(`/api/v1/eresources/external/${internalResource._id}/content?format=epub`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 403, 502]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.message).not.toContain('169.254.169.254');
    });

    it('rejects reader streaming when resource points to decimal-encoded IP http://2130706433', async () => {
      await EResource.findByIdAndUpdate(internalResource._id, {
        epubUrl: 'http://2130706433/admin',
      });

      const res = await request(app)
        .get(`/api/v1/reader/${internalResource._id}/content?format=epub`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 403, 502]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.message).not.toContain('2130706433');
    });

    it('rejects reader streaming when resource points to IPv6 loopback http://[::1]', async () => {
      await EResource.findByIdAndUpdate(internalResource._id, {
        epubUrl: 'http://[::1]/private',
      });

      const res = await request(app)
        .get(`/api/v1/reader/${internalResource._id}/content?format=epub`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 403, 502]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('rejects reader streaming when resource points to http://localhost', async () => {
      await EResource.findByIdAndUpdate(internalResource._id, {
        epubUrl: 'http://localhost:3000/api/keys',
      });

      const res = await request(app)
        .get(`/api/v1/reader/${internalResource._id}/content?format=epub`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([400, 403, 502]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.message).not.toContain('localhost');
    });

    it('requires authentication on proxy and reader content endpoints (401)', async () => {
      const unauthProxy = await request(app).get(
        `/api/v1/eresources/external/${internalResource._id}/content?format=epub`
      );
      expect(unauthProxy.status).toBe(401);

      const unauthReader = await request(app).get(
        `/api/v1/reader/${internalResource._id}/content?format=epub`
      );
      expect(unauthReader.status).toBe(401);
    });
  });
});
