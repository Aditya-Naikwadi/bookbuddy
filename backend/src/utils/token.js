// Utility functions for generating, signing, and hashing tokens.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

const generateTokenPair = (user, impersonationOptions = null) => {
  if (!user || (!user._id && !user.id)) {
    throw new Error('Invalid user object provided for token generation');
  }

  const userId = user._id || user.id;
  const expiry =
    (user.role === 'super-admin' ||
      (impersonationOptions && impersonationOptions.isImpersonated)) &&
    process.env.NODE_ENV !== 'test'
      ? '5m'
      : config.jwt.accessExpiry;

  const payload = {
    sub: userId,
    role: user.role || 'patron',
    collegeId: user.collegeId || null,
  };

  if (impersonationOptions && impersonationOptions.isImpersonated) {
    payload.isImpersonated = true;
    payload.originalSuperAdminId = impersonationOptions.originalSuperAdminId;
  }

  const issuer = config.jwt.issuer || 'bookbuddy-api';
  const audience = config.jwt.audience || 'bookbuddy-client';

  // Access Token payload includes userId (sub), role, and collegeId
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: expiry,
    issuer,
    audience,
  });

  // Refresh Token payload contains minimal info (userId) plus a unique identifier
  const refreshToken = jwt.sign(
    {
      userId,
      jti: crypto.randomBytes(16).toString('hex'),
    },
    config.jwt.refreshSecret,
    {
      algorithm: 'HS256',
      expiresIn: config.jwt.refreshExpiry,
      issuer,
      audience,
    }
  );

  // Hash the refresh token for database persistence
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  return { accessToken, refreshToken, hash };
};

const hashToken = (token) => {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token).digest('hex');
};

const verifyAccessToken = (token, options = {}) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Token string must be provided');
  }

  const expectedIssuer = options.issuer || config.jwt.issuer || 'bookbuddy-api';
  const expectedAudience = options.audience || config.jwt.audience || 'bookbuddy-client';

  // Strictly pin algorithm to HS256 (rejects 'none', algorithm-confusion attacks)
  const decoded = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
  });

  // Verify audience if present in token or required
  if (decoded.aud) {
    const audList = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
    if (!audList.includes(expectedAudience)) {
      throw new jwt.JsonWebTokenError(`jwt audience invalid. expected: ${expectedAudience}`);
    }
  } else if (options.requireAudience) {
    throw new jwt.JsonWebTokenError(`jwt audience missing. expected: ${expectedAudience}`);
  }

  // Verify issuer if present in token or required
  if (decoded.iss) {
    if (decoded.iss !== expectedIssuer) {
      throw new jwt.JsonWebTokenError(`jwt issuer invalid. expected: ${expectedIssuer}`);
    }
  } else if (options.requireIssuer) {
    throw new jwt.JsonWebTokenError(`jwt issuer missing. expected: ${expectedIssuer}`);
  }

  return decoded;
};

const verifyRefreshToken = (token, options = {}) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Token string must be provided');
  }

  const expectedIssuer = options.issuer || config.jwt.issuer || 'bookbuddy-api';
  const expectedAudience = options.audience || config.jwt.audience || 'bookbuddy-client';

  const decoded = jwt.verify(token, config.jwt.refreshSecret, {
    algorithms: ['HS256'],
  });

  if (decoded.aud) {
    const audList = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
    if (!audList.includes(expectedAudience)) {
      throw new jwt.JsonWebTokenError(`jwt audience invalid. expected: ${expectedAudience}`);
    }
  }

  if (decoded.iss && decoded.iss !== expectedIssuer) {
    throw new jwt.JsonWebTokenError(`jwt issuer invalid. expected: ${expectedIssuer}`);
  }

  return decoded;
};

const revokedTokenHashes = new Set();

const blacklistToken = async (token, redisClient = null, reason = 'Token revoked') => {
  if (!token) return;
  const hash = hashToken(token);
  revokedTokenHashes.add(hash);

  if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
    try {
      await redisClient.set(`token:blacklist:${hash}`, '1', 'EX', 3600);
    } catch {
      // Ignore Redis error
    }
  }

  try {
    const RevokedToken = require('../models/RevokedToken');
    await RevokedToken.updateOne(
      { tokenHash: hash },
      { tokenHash: hash, revokedAt: new Date(), reason },
      { upsert: true }
    );
  } catch {
    // Ignore DB fallback error
  }
};

const isTokenBlacklisted = async (token, redisClient = null) => {
  if (!token) return false;
  const hash = hashToken(token);
  if (revokedTokenHashes.has(hash)) return true;

  if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
    try {
      const isBlacklisted = await redisClient.get(`token:blacklist:${hash}`);
      if (isBlacklisted) return true;
    } catch {
      // Fallback to database check
    }
  }

  try {
    const RevokedToken = require('../models/RevokedToken');
    const dbRevoked = await RevokedToken.exists({ tokenHash: hash });
    if (dbRevoked) {
      revokedTokenHashes.add(hash);
      return true;
    }
  } catch {
    // Fail safely
  }

  return false;
};

const generateAccessToken = (user, impersonationOptions = null) => {
  return generateTokenPair(user, impersonationOptions).accessToken;
};

module.exports = {
  generateTokenPair,
  generateAccessToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken,
  blacklistToken,
  isTokenBlacklisted,
};
