const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

describe('Google OAuth 2.0 Single Sign-On Integration Tests', () => {
  it('should reject Google auth request when idToken is missing', async () => {
    const res = await request(app).post('/api/auth/google').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Google ID Token is required');
  });

  it('should authenticate user or provision new student account via Google SSO token', async () => {
    const mockEmail = `test_google_${Date.now()}@example.com`;
    const dummyIdToken = `header.${Buffer.from(
      JSON.stringify({
        sub: `google_id_${Date.now()}`,
        email: mockEmail,
        name: 'Test Google Student',
        picture: 'https://lh3.googleusercontent.com/a/dummy',
      })
    ).toString('base64')}.signature`;

    const res = await request(app).post('/api/auth/google').send({ idToken: dummyIdToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(mockEmail);

    // Verify record in MongoDB
    const createdUser = await User.findOne({ email: mockEmail });
    expect(createdUser).not.toBeNull();
    expect(createdUser.authProvider).toBe('google');
    expect(createdUser.isEmailVerified).toBe(true);
  });
});
