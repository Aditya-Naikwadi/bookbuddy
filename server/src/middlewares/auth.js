// Authentication and authorization middlewares.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const config = require('../config');
const { verifyAccessToken } = require('../utils/token');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Authentication required. No token provided.', 401));
  }

  try {
    const decoded = verifyAccessToken(token);

    // Fetch minimal user status
    const user = await User.findById(decoded.sub).select('isActive');
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated.', 401));
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      collegeId: decoded.collegeId,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired.', 401));
    }
    return next(new AppError('Not authorized. Token verification failed.', 401));
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = {
  protect,
  requireRole,
  restrictTo: requireRole, // Alias for backward compatibility
};
