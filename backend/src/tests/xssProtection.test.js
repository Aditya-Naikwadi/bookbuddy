process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Feedback = require('../models/Feedback');
const Announcement = require('../models/Announcement');
const Review = require('../models/Review');
const Complaint = require('../models/Complaint');
const RegistrationRequest = require('../models/RegistrationRequest');
const EResource = require('../models/EResource');

const { isSafeUrl, sanitizeUrl } = require('@bookbuddy/shared');
const { getAuthCookieOptions } = require('../utils/cookieOptions');
const { createTestCollege, createTestUser } = require('./helpers/testFactories');

describe('Cross-Site Scripting (XSS) Hardening Test Suite', () => {
  let testCollege;
  let testUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test');
    }

    testCollege = await createTestCollege({
      name: 'XSS Test College',
      slug: 'xss-test-college',
      code: 'XTIC',
    });

    testUser = await createTestUser({
      collegeId: testCollege._id,
      email: 'xss_tester@example.com',
      password: 'SecurePassword123!',
      role: 'student',
    });
  });

  afterAll(async () => {
    try {
      await College.deleteMany({ slug: 'xss-test-college' });
      await User.deleteMany({ email: 'xss_tester@example.com' });
      await Feedback.deleteMany({ collegeId: testCollege?._id });
      await Announcement.deleteMany({ collegeId: testCollege?._id });
      await Review.deleteMany({ collegeId: testCollege?._id });
      await Complaint.deleteMany({ collegeId: testCollege?._id });
      await RegistrationRequest.deleteMany({ 'tenantData.legalName': 'XSS Injected College' });
      await EResource.deleteMany({ collegeId: testCollege?._id });
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // Best-effort cleanup
    }
  });

  describe('1. Security Headers (CSP, NoSniff, Referrer-Policy)', () => {
    it('should include Content-Security-Policy header restricting unsafe execution', async () => {
      const res = await request(app).get('/health');
      expect(res.headers).toHaveProperty('content-security-policy');

      const csp = res.headers['content-security-policy'];
      // Unsafe-eval must be disallowed in hardened script-src
      expect(csp).not.toContain("'unsafe-eval'");
      // object-src must be restricted to none
      expect(csp).toContain("object-src 'none'");
      // base-uri must be restricted to self
      expect(csp).toContain("base-uri 'self'");
    });

    it('should enforce X-Content-Type-Options: nosniff header', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should enforce Referrer-Policy: strict-origin-when-cross-origin header', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('2. HttpOnly Cookie Hardening', () => {
    it('should always set httpOnly: true on authentication cookie options', () => {
      const options = getAuthCookieOptions({});
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/');
    });
  });

  describe('3. Dynamic URL Scheme Validation (javascript: XSS Prevention)', () => {
    it('should reject javascript: pseudo-protocol in isSafeUrl', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('JAVASCRIPT:alert(document.cookie)')).toBe(false);
      expect(isSafeUrl('  javascript:alert(1)  ')).toBe(false);
      expect(isSafeUrl('\x00javascript:alert(1)')).toBe(false);
    });

    it('should reject data: and vbscript: execution vectors in isSafeUrl', () => {
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('//malicious-phishing.com/evil')).toBe(false);
    });

    it('should allow valid http, https, mailto, and relative application routes', () => {
      expect(isSafeUrl('https://example.com/docs/manual.pdf')).toBe(true);
      expect(isSafeUrl('http://localhost:5173/auth/login')).toBe(true);
      expect(isSafeUrl('mailto:librarian@college.edu')).toBe(true);
      expect(isSafeUrl('/student/reading-lists?id=123')).toBe(true);
      expect(isSafeUrl('#section-2')).toBe(true);
    });

    it('should sanitize unsafe URLs to fallback anchor via sanitizeUrl', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeUrl('javascript:void(0)', '')).toBe('');
      expect(sanitizeUrl('https://valid.com')).toBe('https://valid.com');
    });

    it('should reject RegistrationRequest with javascript: in verificationDocumentUrl', async () => {
      const requestDoc = new RegistrationRequest({
        type: 'tenant_onboarding',
        status: 'submitted',
        tenantData: {
          legalName: 'XSS Injected College',
          shortName: 'XSS',
          institutionType: 'college',
          domain: 'xss-injected.edu',
          contactEmail: 'admin@xss-injected.edu',
          adminName: 'Admin',
          adminEmail: 'admin@xss-injected.edu',
          verificationDocumentUrl: 'javascript:alert(document.domain)',
        },
      });

      await expect(requestDoc.validate()).rejects.toThrow(
        /Invalid or unsafe verification document URL/i
      );
    });

    it('should reject EResource with javascript: in fileUrl', async () => {
      const resource = new EResource({
        collegeId: testCollege._id,
        title: 'Exploit Book',
        author: 'Attacker',
        type: 'pdf',
        fileUrl: 'javascript:alert("XSS")',
        uploadedBy: testUser._id,
      });

      await expect(resource.validate()).rejects.toThrow(/Invalid or unsafe file URL scheme/i);
    });
  });

  describe('4. HTML Sanitization on User-Generated Fields', () => {
    it('should sanitize <script> and <img> onerror tags in Feedback message', async () => {
      const feedback = await Feedback.create({
        collegeId: testCollege._id,
        submittedBy: testUser._id,
        category: 'general',
        message: '<script>alert(1)</script><img src=x onerror=alert(1)>Great library!',
        rating: 5,
      });

      expect(feedback.message).not.toContain('<script>');
      expect(feedback.message).not.toContain('<img');
      expect(feedback.message).toContain('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
      expect(feedback.message).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('should sanitize <script> tags in Announcement title and content', async () => {
      const announcement = await Announcement.create({
        collegeId: testCollege._id,
        title: '<script>alert("title XSS")</script>Important Notice',
        content: '<img src=x onerror=alert("content XSS")>Body text',
        priority: 'info',
      });

      expect(announcement.title).not.toContain('<script>');
      expect(announcement.title).toContain('&lt;script&gt;');
      expect(announcement.content).not.toContain('<img');
      expect(announcement.content).toContain('&lt;img');
    });

    it('should sanitize <script> and <img> in Review title, comment, and text', async () => {
      const review = await Review.create({
        collegeId: testCollege._id,
        userId: testUser._id,
        rating: 4,
        title: '<script>alert("review title")</script>',
        comment: '<img src=x onerror=alert("review comment")>',
        text: '<script>alert("review text")</script>',
      });

      expect(review.title).not.toContain('<script>');
      expect(review.comment).not.toContain('<img');
      expect(review.text).not.toContain('<script>');
      expect(review.title).toContain('&lt;script&gt;');
      expect(review.comment).toContain('&lt;img');
    });

    it('should sanitize Complaint subject, description, and resolutionMessage', async () => {
      const complaint = await Complaint.create({
        collegeId: testCollege._id,
        submittedBy: testUser._id,
        subject: '<script>alert("complaint subject")</script>',
        description: '<img src=x onerror=alert("complaint description")>',
        resolutionMessage: '<script>alert("resolution")</script>',
      });

      expect(complaint.subject).not.toContain('<script>');
      expect(complaint.description).not.toContain('<img');
      expect(complaint.resolutionMessage).not.toContain('<script>');
      expect(complaint.subject).toContain('&lt;script&gt;');
    });
  });
});
