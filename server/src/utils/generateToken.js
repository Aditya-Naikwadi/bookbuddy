const jwt = require('jsonwebtoken');
const config = require('../config');

const generateToken = (res, userId) => {
  if (!userId) {
    throw new Error('User ID must be provided to generate token');
  }

  const jwtSecret = config.jwt.secret || process.env.JWT_SECRET;
  const refreshSecret = config.jwt.refreshSecret || process.env.JWT_REFRESH_SECRET;

  const token = jwt.sign({ userId }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.accessExpiry || '15m',
  });

  const refreshToken = jwt.sign({ userId }, refreshSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.refreshExpiry || '7d',
  });

  if (res && typeof res.cookie === 'function') {
    res.cookie('jwt_refresh', refreshToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  return token;
};

module.exports = generateToken;
