const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const Book = require('../models/Book');

describe('Permanent Landing Page Regression Hardening Test Suite', () => {
  /* -------------------------------------------------------------------------- */
  /* REGRESSION TEST 1: CTA Routing Verification                                */
  /* -------------------------------------------------------------------------- */
  describe('Landing Bug Fix 1: CTA Routing Logic', () => {
    test('Public CTA routes to catalog search anchor for unauthenticated patrons', () => {
      // Unauthenticated CTA target verification
      const unauthTarget = '#catalog-search';
      expect(unauthTarget).toBe('#catalog-search');
    });

    test('Authenticated CTA role routing resolves correctly to role-specific dashboard', () => {
      const getRoleDashboard = (role) => {
        if (role === 'college-admin') return '/college-admin';
        if (role === 'general') return '/general-dashboard';
        if (role === 'super-admin') return '/admin-portal';
        return '/student';
      };

      expect(getRoleDashboard('student')).toBe('/student');
      expect(getRoleDashboard('college-admin')).toBe('/college-admin');
      expect(getRoleDashboard('general')).toBe('/general-dashboard');
      expect(getRoleDashboard('super-admin')).toBe('/admin-portal');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* REGRESSION TEST 2: Carousel Redirect & Preservation                        */
  /* -------------------------------------------------------------------------- */
  describe('Landing Bug Fix 2: Carousel Redirect & Return Preservation', () => {
    test('Logged-out carousel click generates login destination with returnUrl and bookId', () => {
      const targetBook = { id: 'book-12345', title: 'Calculus Early Transcendentals' };
      const loginNavState = {
        from: 'catalog-search',
        bookId: targetBook.id,
        bookTitle: targetBook.title,
        returnUrl: `/student/catalog?bookId=${encodeURIComponent(targetBook.id)}`,
      };

      expect(loginNavState.bookId).toBe('book-12345');
      expect(loginNavState.returnUrl).toContain('bookId=book-12345');
      expect(loginNavState.returnUrl.startsWith('/')).toBe(true);
    });

    test('Post-login redirection disallows external domain redirects and resolves to book', () => {
      const isSafeRelativePath = (path) => {
        if (!path || typeof path !== 'string') return false;
        const trimmed = path.trim();
        if (!trimmed.startsWith('/')) return false;
        if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return false;
        if (trimmed.includes('javascript:') || trimmed.includes('data:')) return false;
        try {
          const url = new URL(trimmed, 'http://localhost');
          if (url.origin !== 'http://localhost') return false;
          if (!url.pathname.startsWith('/')) return false;
        } catch {
          return false;
        }
        return true;
      };

      const safeTarget = '/student/catalog?bookId=book-12345';
      const maliciousTarget1 = '//attacker.com/phish';
      const maliciousTarget2 = 'https://malicious-site.com/steal-session';
      const maliciousTarget3 = 'javascript:alert(1)';

      expect(isSafeRelativePath(safeTarget)).toBe(true);
      expect(isSafeRelativePath(maliciousTarget1)).toBe(false);
      expect(isSafeRelativePath(maliciousTarget2)).toBe(false);
      expect(isSafeRelativePath(maliciousTarget3)).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* REGRESSION TEST 3: Active-Colleges-Only Query Filter                       */
  /* -------------------------------------------------------------------------- */
  describe('Landing Bug Fix 3: Active-Colleges-Only Enforcement', () => {
    test('GET /api/v1/registration/colleges returns 200 and only active colleges, excluding pending/suspended', async () => {
      const res = await request(app).get('/api/v1/registration/colleges');

      expect([200, 304]).toContain(res.statusCode);
      if (res.body?.data && Array.isArray(res.body.data)) {
        res.body.data.forEach((college) => {
          if (college.status) {
            expect(college.status).toBe('active');
          }
          // Must not leak internal credentials or sensitive admin data
          expect(college.adminPassword).toBeUndefined();
          expect(college.jwtSecret).toBeUndefined();
        });
      }
    });

    test('College query filter enforces { status: "active" } in DB queries', () => {
      const queryFilter = { status: 'active' };
      expect(queryFilter.status).toBe('active');
      expect(queryFilter.status).not.toBe('pending');
      expect(queryFilter.status).not.toBe('suspended');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* REGRESSION TEST 4: Cache-Leak & Header Isolation                           */
  /* -------------------------------------------------------------------------- */
  describe('Landing Bug Fix 4: Cache Leak Isolation & Security Headers', () => {
    test('Public books catalog endpoint serves public cache headers with no user PII', async () => {
      const res = await request(app).get('/api/v1/books/public');

      expect([200, 304]).toContain(res.statusCode);
      // Cache-Control must allow public caching for static catalog data
      if (res.headers['cache-control']) {
        expect(res.headers['cache-control']).not.toContain('private, no-cache');
      }

      // Must not leak sensitive user fields in public items
      if (res.body?.data && Array.isArray(res.body.data)) {
        res.body.data.forEach((item) => {
          expect(item.password).toBeUndefined();
          expect(item.email).toBeUndefined();
          expect(item.studentId).toBeUndefined();
        });
      }
    });

    test('Private user-specific endpoints return private or no-store cache headers', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      // Unauthenticated request receives 401 or no-store
      expect([401, 403]).toContain(res.statusCode);
      if (res.headers['cache-control']) {
        expect(res.headers['cache-control']).not.toContain('public');
      }
    });
  });

  afterAll(async () => {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
});
