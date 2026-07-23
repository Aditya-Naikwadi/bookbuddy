const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(new Error('Invalid or expired authentication token'));
    }

    // Verify user exists and is active in the database
    const user = await User.findById(decoded.sub).select('isActive');
    if (!user) {
      return next(new Error('User belonging to this token no longer exists'));
    }

    if (!user.isActive) {
      return next(new Error('Account has been deactivated'));
    }

    // Attach user information to socket data
    socket.data.user = {
      id: decoded.sub,
      role: decoded.role,
      collegeId: decoded.collegeId,
    };

    next();
  } catch {
    next(new Error('Internal server error during socket authentication'));
  }
};

module.exports = socketAuth;
