// Utility functions for generating, signing, and hashing tokens.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

const generateTokenPair = (user) => {
  // Access Token payload includes userId (sub), role, and collegeId
  const accessToken = jwt.sign(
    {
      sub: user._id,
      role: user.role,
      collegeId: user.collegeId,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry }
  );

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
  return jwt.verify(token, config.jwt.secret);
};

module.exports = {
  generateTokenPair,
  hashToken,
  verifyAccessToken,
};
