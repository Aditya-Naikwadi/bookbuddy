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
    const user = await User.findById(decoded.sub).select('isActive role collegeId');
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated.', 401));
    }

    // Check college suspension/archival for non-super-admins
    if (user.role !== 'super-admin' && user.collegeId) {
      const collegeIdStr = user.collegeId.toString();
      let collegeStatus = null;

      const { redisClient } = require('./rateLimiters');
      if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
        try {
          collegeStatus = await redisClient.get(`college:status:${collegeIdStr}`);
        } catch (err) {
          // ignore cache errors, fallback to DB
        }
      }

      if (!collegeStatus) {
        const College = require('../models/College');
        const college = await College.findById(collegeIdStr).select('status');
        if (!college) {
          return next(new AppError('Associated college not found.', 404));
        }
        collegeStatus = college.status;

        if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
          try {
            await redisClient.set(`college:status:${collegeIdStr}`, collegeStatus, 'EX', 60);
          } catch (err) {
            // ignore cache set errors
          }
        }
      }

      if (collegeStatus === 'suspended') {
        return next(
          new AppError('Your college has been suspended by the platform administrator.', 403)
        );
      }
      if (collegeStatus === 'archived') {
        return next(
          new AppError('Your college has been archived and is no longer accessible.', 403)
        );
      }
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id, // Compatibility shim to prevent tenant isolation leaks on legacy controllers
      role: user.role,
      collegeId: user.collegeId,
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
