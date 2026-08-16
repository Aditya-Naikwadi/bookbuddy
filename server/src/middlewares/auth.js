// Authentication and authorization middlewares.
const User = require('../models/User');
const AppError = require('../utils/AppError');
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
    const user = await User.findById(decoded.sub).select(
      'isActive role collegeId subRole permissions isMfaEnabled'
    );
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
        } catch {
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
          } catch {
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
      subRole: user.subRole || 'root_admin',
      permissions: user.permissions || [],
      isMfaEnabled: !!user.isMfaEnabled,
      collegeId: user.collegeId,
      isImpersonated: !!decoded.isImpersonated,
      originalSuperAdminId: decoded.originalSuperAdminId || null,
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

const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    // Root super-admins bypass specific permission checks
    if (req.user.role === 'super-admin' && req.user.subRole === 'root_admin') {
      return next();
    }
    const userPerms = req.user.permissions || [];
    const hasPerm = requiredPermissions.some((p) => userPerms.includes(p));
    if (!hasPerm) {
      return next(
        new AppError(
          'Insufficient sub-role permissions to access this administrative resource.',
          403
        )
      );
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).select(
        'isActive role collegeId subRole permissions'
      );
      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          _id: user._id,
          role: user.role,
          subRole: user.subRole || 'root_admin',
          permissions: user.permissions || [],
          collegeId: user.collegeId ? user.collegeId.toString() : null,
        };
      }
    } catch {
      // Ignore token verification errors for optional auth
    }
  }
  next();
};

module.exports = {
  protect,
  authMiddleware: protect,
  requireAuth: protect,
  requireRole,
  requirePermission,
  optionalAuth,
  restrictTo: requireRole, // Alias for backward compatibility
};
