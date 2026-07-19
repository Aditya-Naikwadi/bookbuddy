const request = require('supertest');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshsecret';
jest.setTimeout(60000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const RefreshToken = require('../models/RefreshToken');

describe('ITEM 1 — Auth: httpOnly Cookies, Refresh Token Rotation, Theft Detection & CSRF', () => {
  let testCollege;
  let testUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await College.deleteMany({});
    await RefreshToken.deleteMany({});

    testCollege = await College.create({
      name: 'Auth Testing Institute',
      code: 'AUTH101',
      maxFineLimit: 100,
    });

    testUser = await User.create({
      studentId: 'STU_AUTH_001',
      name: 'Auth Test Student',
      email: 'authtest@bookbuddy.com',
      password: 'Password@123',
      role: 'student',
      collegeId: testCollege._id,
    });
  });

  const getCookieFromRes = (res, cookieName) => {
    const cookies = res.headers['set-cookie'];
    if (!cookies) return null;
    const target = cookies.find((c) => c.startsWith(`${cookieName}=`));
    if (!target) return null;
    return target.split(';')[0].split('=')[1];
  };

  test('1.1 Login sets httpOnly refreshToken cookie and returns access token in body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authtest@bookbuddy.com', password: 'Password@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeUndefined();

    const refreshCookie = getCookieFromRes(res, 'refreshToken');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie.length).toBeGreaterThan(20);

    const tokensInDb = await RefreshToken.find({ userId: testUser._id });
    expect(tokensInDb.length).toBe(1);
    expect(tokensInDb[0].revokedAt).toBeNull();
  });

  test('1.2 Refresh-token rotation succeeds on valid use (issues new token pair, revokes old)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authtest@bookbuddy.com', password: 'Password@123' });

    const firstCookie = getCookieFromRes(loginRes, 'refreshToken');
    expect(firstCookie).toBeDefined();

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${firstCookie}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.accessToken).toBeDefined();

    const secondCookie = getCookieFromRes(refreshRes, 'refreshToken');
    expect(secondCookie).toBeDefined();
    expect(secondCookie).not.toBe(firstCookie);

    const activeTokens = await RefreshToken.find({ userId: testUser._id, revokedAt: null });
    const revokedTokens = await RefreshToken.find({
      userId: testUser._id,
      revokedAt: { $ne: null },
    });

    expect(activeTokens.length).toBe(1);
    expect(revokedTokens.length).toBe(1);
    expect(revokedTokens[0].replacedBy).toBeDefined();
  });

  test('1.3 Reuse of an already-rotated (revoked) refresh token is rejected AND revokes all sessions for that user', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authtest@bookbuddy.com', password: 'Password@123' });
    const firstCookie = getCookieFromRes(loginRes, 'refreshToken');

    await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${firstCookie}`]);

    const reuseRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${firstCookie}`]);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.message).toContain('Session reuse detected');

    const activeTokens = await RefreshToken.find({ userId: testUser._id, revokedAt: null });
    const allTokens = await RefreshToken.find({ userId: testUser._id });

    expect(activeTokens.length).toBe(0);
    expect(allTokens.length).toBeGreaterThan(0);
    allTokens.forEach((t) => {
      expect(t.revokedAt).not.toBeNull();
    });
  });

  test('1.4 A state-changing request without a valid CSRF token is rejected with 403', async () => {
    const csrfRes = await request(app).get('/api/auth/csrf-token');
    expect(csrfRes.status).toBe(200);
    const csrfCookie = getCookieFromRes(csrfRes, '_csrf');
    const csrfToken = csrfRes.body.csrfToken;

    expect(csrfCookie).toBeDefined();
    expect(csrfToken).toBeDefined();

    const badRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`_csrf=${csrfCookie}`]);

    expect(badRes.status).toBe(403);
    expect(badRes.body.message).toContain('CSRF');

    const goodRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`_csrf=${csrfCookie}`])
      .set('x-csrf-token', csrfToken);

    expect(goodRes.status).toBe(200);
  });

  test('1.5 Client source code audit: No access or refresh token is written to localStorage', () => {
    const clientSrcDir = path.join(__dirname, '../../../../client/src');
    if (!fs.existsSync(clientSrcDir)) {
      return;
    }

    const scanDir = (dir) => {
      const files = fs.readdirSync(dir);
      let forbiddenHits = [];

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          forbiddenHits = forbiddenHits.concat(scanDir(fullPath));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (
            content.includes("localStorage.setItem('token'") ||
            content.includes("localStorage.setItem('accessToken'") ||
            content.includes("localStorage.setItem('refreshToken'") ||
            content.includes("localStorage.setItem('auth-storage'")
          ) {
            forbiddenHits.push(fullPath);
          }
        }
      }
      return forbiddenHits;
    };

    const hits = scanDir(clientSrcDir);
    expect(hits).toEqual([]);
  });
});
