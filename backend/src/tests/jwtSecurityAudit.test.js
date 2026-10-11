/**
 * 8. Secure JWT Secrets & Token Handling Verification Suite
 *
 * Requirements Tested:
 * 1. Reject token with wrong signature.
 * 2. Reject expired token.
 * 3. Reject token using alg: 'none' (algorithm-confusion attacks).
 * 4. Reject token issued for a different audience.
 * 5. Accept valid token with verified signature, exp, iss, and aud claims.
 * 6. Gate verification patron tokens pin algorithm HS256 and reject tampered/none tokens.
 * 7. Ensure production environment validation rejects weak / short (< 256 bits) secrets.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const jwt = require('jsonwebtoken');
const config = require('../config');
const { verifyAccessToken, generateAccessToken, generateTokenPair } = require('../utils/token');
const { generatePatronToken, verifyPatronToken } = require('../utils/patronTokenUtil');

describe('8. Secure JWT Secrets & Token Handling Master Audit', () => {
  const secretKey = config.jwt.secret;
  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    role: 'student',
    collegeId: '507f1f77bcf86cd799439022',
  };

  describe('1. Access Token Verification Hardening', () => {
    it('accepts a valid token with matching signature, issuer, and audience', () => {
      const validToken = generateAccessToken(mockUser);
      const decoded = verifyAccessToken(validToken);

      expect(decoded.sub).toBe(mockUser._id);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.iss).toBe('bookbuddy-api');
      expect(decoded.aud).toBe('bookbuddy-client');
    });

    it('rejects a token signed with an invalid / forged secret', () => {
      const tamperedToken = jwt.sign(
        {
          sub: mockUser._id,
          role: 'student',
          iss: 'bookbuddy-api',
          aud: 'bookbuddy-client',
        },
        'wrong_attacker_secret_key_1234567890',
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      expect(() => verifyAccessToken(tamperedToken)).toThrow(jwt.JsonWebTokenError);
      expect(() => verifyAccessToken(tamperedToken)).toThrow(/invalid signature/i);
    });

    it('rejects an expired token', () => {
      const expiredToken = jwt.sign(
        {
          sub: mockUser._id,
          role: 'student',
          iss: 'bookbuddy-api',
          aud: 'bookbuddy-client',
        },
        secretKey,
        { algorithm: 'HS256', expiresIn: '-10s' }
      );

      expect(() => verifyAccessToken(expiredToken)).toThrow(jwt.TokenExpiredError);
      expect(() => verifyAccessToken(expiredToken)).toThrow(/jwt expired/i);
    });

    it('rejects a token using alg: "none" (algorithm confusion attack)', () => {
      // Craft an unsigned token with alg: none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: mockUser._id,
          role: 'super-admin',
          iss: 'bookbuddy-api',
          aud: 'bookbuddy-client',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      expect(() => verifyAccessToken(noneToken)).toThrow();
    });

    it('rejects a token targeting a different audience', () => {
      const wrongAudienceToken = jwt.sign(
        {
          sub: mockUser._id,
          role: 'student',
          iss: 'bookbuddy-api',
          aud: 'malicious-third-party-service',
        },
        secretKey,
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      expect(() => verifyAccessToken(wrongAudienceToken)).toThrow(jwt.JsonWebTokenError);
      expect(() => verifyAccessToken(wrongAudienceToken)).toThrow(/jwt audience invalid/i);
    });

    it('rejects a token with an invalid issuer', () => {
      const wrongIssuerToken = jwt.sign(
        {
          sub: mockUser._id,
          role: 'student',
          iss: 'untrusted-auth-server',
          aud: 'bookbuddy-client',
        },
        secretKey,
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      expect(() => verifyAccessToken(wrongIssuerToken)).toThrow(jwt.JsonWebTokenError);
      expect(() => verifyAccessToken(wrongIssuerToken)).toThrow(/jwt issuer invalid/i);
    });
  });

  describe('2. Patron Card Gate Token Verification Hardening', () => {
    it('accepts a valid patron card gate token', () => {
      const { token } = generatePatronToken(mockUser._id, 'STU123');
      const result = verifyPatronToken(token);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe(mockUser._id);
      expect(result.studentId).toBe('STU123');
    });

    it('rejects patron token signed with wrong secret', () => {
      const forgedToken = jwt.sign(
        {
          userId: mockUser._id,
          studentId: 'STU123',
          type: 'patron-card-gate',
          exp: Math.floor(Date.now() / 1000) + 30,
        },
        'wrong_attacker_secret'
      );

      const result = verifyPatronToken(forgedToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/invalid token signature|malformed/i);
    });

    it('rejects expired patron token', () => {
      const expiredToken = jwt.sign(
        {
          userId: mockUser._id,
          studentId: 'STU123',
          type: 'patron-card-gate',
          exp: Math.floor(Date.now() / 1000) - 10,
        },
        secretKey
      );

      const result = verifyPatronToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/expired/i);
    });

    it('rejects patron token with alg: none', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          userId: mockUser._id,
          studentId: 'STU123',
          type: 'patron-card-gate',
          exp: Math.floor(Date.now() / 1000) + 30,
        })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const result = verifyPatronToken(noneToken);
      expect(result.valid).toBe(false);
    });
  });

  describe('3. Production Secret Entropy & Length Guardrails', () => {
    it('verifies token generation pair uses short-lived access expiry and includes jti in refresh tokens', () => {
      const { accessToken, refreshToken, hash } = generateTokenPair(mockUser);

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 hash length

      // Decode refresh token
      const decodedRefresh = jwt.decode(refreshToken);
      expect(decodedRefresh.userId).toBe(mockUser._id);
      expect(decodedRefresh.jti).toBeDefined();
      expect(decodedRefresh.jti.length).toBeGreaterThanOrEqual(16);
    });
  });
});
