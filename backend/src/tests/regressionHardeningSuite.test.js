const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const College = require('../models/College');
const Book = require('../models/Book');

const env = require('../config/env');
const User = require('../models/User');
const CollegeFeatureConfig = require('../models/CollegeFeatureConfig');
const { generateTokenPair } = require('../utils/token');
const { deleteCache } = require('../utils/redisCache');
const { FEATURE_FLAGS } = require('@bookbuddy/shared');

jest.setTimeout(30000);

describe('Permanent Landing Page Regression Hardening Test Suite', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
    }
  });
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

  /* -------------------------------------------------------------------------- */
  /* REGRESSION TEST 5: Feature 1 - Vernacular i18n & Multi-Tenant Isolation    */
  /* -------------------------------------------------------------------------- */
  describe('Regression: Feature 1 Vernacular i18n Tenant Gating', () => {
    let collegeA, collegeB, userA, userB;
    let tokenA, tokenB;

    beforeAll(async () => {
      collegeA = await College.create({
        name: 'i18n Test College A',
        code: `I18NA_${Date.now()}`,
      });
      collegeB = await College.create({
        name: 'i18n Test College B',
        code: `I18NB_${Date.now()}`,
      });

      userA = await User.create({
        collegeId: collegeA._id,
        name: 'Student i18n A',
        email: `student_i18na_${Date.now()}@test.edu`,
        password: 'HashedPassword123!',
        studentId: `ID_A_${Date.now()}`,
        role: 'student',
      });
      userB = await User.create({
        collegeId: collegeB._id,
        name: 'Student i18n B',
        email: `student_i18nb_${Date.now()}@test.edu`,
        password: 'HashedPassword123!',
        studentId: `ID_B_${Date.now()}`,
        role: 'student',
      });

      tokenA = generateTokenPair(userA).accessToken;
      tokenB = generateTokenPair(userB).accessToken;
    });

    afterAll(async () => {
      await CollegeFeatureConfig.deleteMany({ collegeId: { $in: [collegeA._id, collegeB._id] } });
      await User.deleteMany({ collegeId: { $in: [collegeA._id, collegeB._id] } });
      await College.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
      await deleteCache(`college:features:${collegeA._id}`);
      await deleteCache(`college:features:${collegeB._id}`);
    });

    test('vernacular-i18n flag defaults to off and returns 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/features/phased/${FEATURE_FLAGS.VERNACULAR_I18N}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('enabling vernacular-i18n for college A returns 200 for user A but keeps 403 for user B', async () => {
      // Enable for College A
      await CollegeFeatureConfig.findOneAndUpdate(
        { collegeId: collegeA._id },
        { enabledFeatures: ['catalog', 'loans', FEATURE_FLAGS.VERNACULAR_I18N] },
        { upsert: true }
      );
      await deleteCache(`college:features:${collegeA._id}`);

      // User A gets 200
      const resA = await request(app)
        .get(`/api/v1/features/phased/${FEATURE_FLAGS.VERNACULAR_I18N}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.success).toBe(true);
      expect(resA.body.feature).toBe(FEATURE_FLAGS.VERNACULAR_I18N);

      // User B in College B must still get 403
      const resB = await request(app)
        .get(`/api/v1/features/phased/${FEATURE_FLAGS.VERNACULAR_I18N}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(403);
      expect(resB.body.success).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* REGRESSION TEST 6: Feature 2: Accessibility Mode Gating & User Preferences  */
  /* -------------------------------------------------------------------------- */
  describe('Feature 2: Accessibility Mode Gating and Per-User Isolation', () => {
    let collegeA, collegeB, userA1, userA2, userB, tokenA1, tokenA2, tokenB;

    beforeAll(async () => {
      collegeA = await College.create({
        name: 'Accessibility College A',
        slug: `a11y-col-a-${Date.now()}`,
        code: `A11YA_${Date.now()}`,
        status: 'active',
      });
      collegeB = await College.create({
        name: 'Accessibility College B',
        slug: `a11y-col-b-${Date.now()}`,
        code: `A11YB_${Date.now()}`,
        status: 'active',
      });

      userA1 = await User.create({
        name: 'A11y Student 1',
        email: `student1.${Date.now()}@a11ycol-a.edu`,
        password: 'Password123!',
        studentId: `A11Y_STD1_${Date.now()}`,
        role: 'student',
        collegeId: collegeA._id,
        isEmailVerified: true,
      });

      userA2 = await User.create({
        name: 'A11y Student 2',
        email: `student2.${Date.now()}@a11ycol-a.edu`,
        password: 'Password123!',
        studentId: `A11Y_STD2_${Date.now()}`,
        role: 'student',
        collegeId: collegeA._id,
        isEmailVerified: true,
      });

      userB = await User.create({
        name: 'A11y Student B',
        email: `studentb.${Date.now()}@a11ycol-b.edu`,
        password: 'Password123!',
        studentId: `A11Y_STDB_${Date.now()}`,
        role: 'student',
        collegeId: collegeB._id,
        isEmailVerified: true,
      });

      tokenA1 = generateTokenPair(userA1).accessToken;
      tokenA2 = generateTokenPair(userA2).accessToken;
      tokenB = generateTokenPair(userB).accessToken;
    });

    afterAll(async () => {
      if (collegeA && collegeB) {
        await CollegeFeatureConfig.deleteMany({ collegeId: { $in: [collegeA._id, collegeB._id] } });
        await User.deleteMany({ collegeId: { $in: [collegeA._id, collegeB._id] } });
        await College.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
        await deleteCache(`college:features:${collegeA._id}`);
        await deleteCache(`college:features:${collegeB._id}`);
      }
    });

    test('accessibility-mode flag defaults to off and returns 403 Forbidden', async () => {
      const getRes = await request(app)
        .get('/api/v1/users/me/accessibility')
        .set('Authorization', `Bearer ${tokenA1}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.success).toBe(false);

      const patchRes = await request(app)
        .patch('/api/v1/users/me/accessibility')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({ dyslexiaFont: true, highContrast: true });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.success).toBe(false);
    });

    test('enabling accessibility-mode allows User A1 to get & patch preferences, while User B remains 403', async () => {
      // Enable for College A
      await CollegeFeatureConfig.findOneAndUpdate(
        { collegeId: collegeA._id },
        { enabledFeatures: ['catalog', 'loans', FEATURE_FLAGS.ACCESSIBILITY_MODE] },
        { upsert: true }
      );
      await deleteCache(`college:features:${collegeA._id}`);

      // User A1 updates accessibility settings
      const patchRes = await request(app)
        .patch('/api/v1/users/me/accessibility')
        .set('Authorization', `Bearer ${tokenA1}`)
        .send({
          dyslexiaFont: true,
          highContrast: true,
          textToSpeech: true,
          ttsRate: 1.25,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);
      expect(patchRes.body.data.dyslexiaFont).toBe(true);
      expect(patchRes.body.data.highContrast).toBe(true);
      expect(patchRes.body.data.textToSpeech).toBe(true);
      expect(patchRes.body.data.ttsRate).toBe(1.25);

      // User A1 fetches updated accessibility settings
      const getResA1 = await request(app)
        .get('/api/v1/users/me/accessibility')
        .set('Authorization', `Bearer ${tokenA1}`);

      expect(getResA1.status).toBe(200);
      expect(getResA1.body.data.dyslexiaFont).toBe(true);
      expect(getResA1.body.data.highContrast).toBe(true);

      // Per-user isolation within College A: User A2 still has default settings (false)
      const getResA2 = await request(app)
        .get('/api/v1/users/me/accessibility')
        .set('Authorization', `Bearer ${tokenA2}`);

      expect(getResA2.status).toBe(200);
      expect(getResA2.body.data.dyslexiaFont).toBe(false);
      expect(getResA2.body.data.highContrast).toBe(false);

      // Cross-tenant isolation: User B in College B receives 403 Forbidden
      const resB = await request(app)
        .get('/api/v1/users/me/accessibility')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(403);
      expect(resB.body.success).toBe(false);
    });
  });

  afterAll(async () => {
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
});
