const jwt = require('jsonwebtoken');
const config = require('../config');

const TOKEN_EXPIRY_SECONDS = 30;

/**
 * Generates a signed 30-second time-boxed verification token for gate scanning.
 */
const generatePatronToken = (
  userId,
  studentId,
  secretKey = config.jwt.secret || process.env.JWT_SECRET
) => {
  if (!secretKey) {
    throw new Error('JWT secret key is required to sign patron tokens');
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_EXPIRY_SECONDS;

  const token = jwt.sign(
    {
      userId: userId.toString(),
      studentId,
      type: 'patron-card-gate',
      exp: expiresAt,
      iss: config.jwt.issuer || 'bookbuddy-api',
      aud: config.jwt.audience || 'bookbuddy-client',
    },
    secretKey,
    { algorithm: 'HS256' }
  );

  return {
    token,
    expiresAt: expiresAt * 1000,
  };
};

/**
 * Validates a scanned patron card gate token.
 */
const verifyPatronToken = (token, secretKey = config.jwt.secret || process.env.JWT_SECRET) => {
  try {
    if (!secretKey) {
      return { valid: false, reason: 'JWT secret key is missing' };
    }
    const decoded = jwt.verify(token, secretKey, {
      algorithms: ['HS256'],
    });
    if (decoded.type !== 'patron-card-gate') {
      return { valid: false, reason: 'Invalid token type' };
    }
    return {
      valid: true,
      userId: decoded.userId,
      studentId: decoded.studentId,
      expiresAt: decoded.exp * 1000,
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, reason: 'Token has expired' };
    }
    return { valid: false, reason: 'Malformed or invalid token signature' };
  }
};

module.exports = {
  generatePatronToken,
  verifyPatronToken,
  TOKEN_EXPIRY_SECONDS,
};
