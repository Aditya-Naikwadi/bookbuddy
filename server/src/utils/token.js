// Utility functions for generating, signing, and hashing tokens.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const generateTokenPair = (user, impersonationOptions = null) => {
  const expiry =
    user.role === 'super-admin' || (impersonationOptions && impersonationOptions.isImpersonated)
      ? '5m'
      : config.jwt.accessExpiry;

  const payload = {
    sub: user._id,
    role: user.role,
    collegeId: user.collegeId,
  };

  if (impersonationOptions && impersonationOptions.isImpersonated) {
    payload.isImpersonated = true;
    payload.originalSuperAdminId = impersonationOptions.originalSuperAdminId;
  }

  // Access Token payload includes userId (sub), role, and collegeId
  const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: expiry });

  // Refresh Token payload contains minimal info (userId) plus a unique identifier to prevent identical token generation in quick succession
  const refreshToken = jwt.sign(
    {
      userId: user._id,
      jti: crypto.randomBytes(16).toString('hex'),
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );

  // Hash the refresh token for database persistence
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  return { accessToken, refreshToken, hash };
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
};

const generateAccessToken = (user, impersonationOptions = null) => {
  return generateTokenPair(user, impersonationOptions).accessToken;
};

module.exports = {
  generateTokenPair,
  generateAccessToken,
  hashToken,
  verifyAccessToken,
};
