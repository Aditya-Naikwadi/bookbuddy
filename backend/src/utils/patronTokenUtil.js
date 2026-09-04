const jwt = require('jsonwebtoken');

const TOKEN_EXPIRY_SECONDS = 30;

/**
 * Generates a signed 30-second time-boxed verification token for gate scanning.
 */
const generatePatronToken = (userId, studentId, secretKey = process.env.JWT_SECRET || 'secret') => {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + TOKEN_EXPIRY_SECONDS;

  const token = jwt.sign(
    {
      userId: userId.toString(),
      studentId,
      type: 'patron-card-gate',
      exp: expiresAt,
    },
    secretKey
  );

  return {
    token,
    expiresAt: expiresAt * 1000,
  };
};

/**
 * Validates a scanned patron card gate token.
 */
const verifyPatronToken = (token, secretKey = process.env.JWT_SECRET || 'secret') => {
  try {
    const decoded = jwt.verify(token, secretKey);
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
