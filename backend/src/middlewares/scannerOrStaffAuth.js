const User = require('../models/User');
const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/token');
const config = require('../config');

const STAFF_ROLES = [
  'college-admin',
  'college_admin',
  'super-admin',
  'super_admin',
  'librarian',
  'staff',
];

/**
 * Scanner API-key / Staff-role authentication middleware
 * Authorizes requests if either:
 * 1. A valid scanner API key is provided via header (x-api-key, x-scanner-key, or Authorization: ApiKey <key>)
 * 2. A valid JWT Bearer token is provided for an active user with a staff/administrative role
 */
const requireScannerOrStaffAuth = async (req, res, next) => {
  // 1. Check for Scanner API Key
  const apiKeyHeader =
    req.headers['x-api-key'] || req.headers['x-scanner-key'] || req.headers['x-scanner-api-key'];

  let apiKey = apiKeyHeader;
  if (!apiKey && req.headers.authorization) {
    const authParts = req.headers.authorization.split(' ');
    const prefix = authParts[0].toLowerCase();
    if ((prefix === 'apikey' || prefix === 'scanner') && authParts[1]) {
      apiKey = authParts[1];
    }
  }

  const expectedScannerKey =
    process.env.SCANNER_API_KEY || config.scannerApiKey || 'bookbuddy_scanner_secret_2026';

  if (apiKey) {
    if (apiKey === expectedScannerKey) {
      req.scanner = {
        isScanner: true,
        type: 'api-key',
      };
      return next();
    }
    return next(new AppError('Invalid scanner API key.', 401));
  }

  // 2. Check for Staff Bearer Token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.sub).select(
        'isActive role collegeId subRole permissions name email'
      );

      if (!user) {
        return next(new AppError('The user belonging to this token no longer exists.', 401));
      }

      if (!user.isActive) {
        return next(new AppError('Your account has been deactivated.', 401));
      }

      if (!STAFF_ROLES.includes(user.role)) {
        return next(
          new AppError(
            'Forbidden: Access restricted to authorized library gate scanners and staff members.',
            403
          )
        );
      }

      req.user = {
        id: user._id.toString(),
        _id: user._id,
        role: user.role,
        collegeId: user.collegeId,
        permissions: user.permissions || [],
      };

      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your staff token has expired.', 401));
      }
      return next(new AppError('Not authorized. Staff token verification failed.', 401));
    }
  }

  // 3. Neither valid API key nor Bearer token provided
  return next(
    new AppError(
      'Authentication required. Please provide a valid scanner API key (x-api-key) or staff authorization token.',
      401
    )
  );
};

module.exports = requireScannerOrStaffAuth;
