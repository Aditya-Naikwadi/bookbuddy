const User = require('../models/User');
const College = require('../models/College');
const AppError = require('../utils/AppError');
const { getAuthCookieOptions } = require('../utils/cookieOptions');
const sessionService = require('../services/sessionService');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Helper to set httpOnly 30-day refresh token cookie
const setRefreshTokenCookie = (res, token, req = null) => {
  const opts = getAuthCookieOptions(req, {
    httpOnly: true,
    path: '/',
    maxAge: THIRTY_DAYS_MS,
  });
  res.cookie('refreshToken', token, opts);
};

const clearRefreshTokenCookie = (res, req = null) => {
  const opts = getAuthCookieOptions(req, {
    httpOnly: true,
    path: '/',
  });
  res.clearCookie('refreshToken', opts);
};

// @desc    Register a new user (public student/admin signup)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    let { studentId, name, email, password, role, collegeId } = req.body;

    if (role === 'super-admin' || role === 'college-admin') {
      return next(new AppError('Public registration of administrative roles is forbidden.', 403));
    }

    if (collegeId) {
      const college = await College.findById(collegeId);
      if (!college || !college.isActive) {
        return next(new AppError('The specified college is inactive or does not exist.', 400));
      }
    } else {
      let defaultCollege = await College.findOne({ status: 'active', isActive: true });
      if (!defaultCollege) {
        defaultCollege = await College.findOne({ isActive: true });
      }
      if (!defaultCollege) {
        defaultCollege = await College.create({
          name: 'Demo College',
          code: 'COLLEGE_A',
          status: 'active',
          isActive: true,
        });
      }
      collegeId = defaultCollege._id;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const targetCollegeId = role === 'super-admin' ? undefined : collegeId;

    const userExists = await User.findOne({
      $or: [
        { email: normalizedEmail },
        ...(targetCollegeId
          ? [{ collegeId: targetCollegeId, studentId: studentId.trim() }]
          : [{ studentId: studentId.trim() }]),
      ],
    });
    if (userExists) {
      return next(
        new AppError('User with this email or Student ID already exists for this college.', 400)
      );
    }

    const user = await User.create({
      studentId: studentId.trim(),
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: role || 'student',
      collegeId: targetCollegeId,
    });

    const logger = require('../utils/logger');
    logger.info(
      `[DB WRITE CONFIRMED] Model: User | _id: ${user._id} | email: ${user.email} | collegeId: ${user.collegeId || 'N/A'} | role: ${user.role}`
    );

    const deviceInfo = req.headers['user-agent'] || 'Web Browser';
    const { accessToken, refreshToken } = await sessionService.createSession({ user, deviceInfo });

    setRefreshTokenCookie(res, refreshToken, req);

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { consumeFailedLogin, resetFailedLogins } = require('../middlewares/loginRateLimiter');
    const { email, studentId, password, totpCode, collegeSlug, collegeId: reqCollegeId } = req.body;
    const credential = (email || studentId || '').trim();
    const normalizedEmail = credential.toLowerCase();

    // Resolve target collegeId if collegeSlug or collegeId is provided in request context
    let targetCollegeId = reqCollegeId;
    if (!targetCollegeId && collegeSlug) {
      const college = await College.findOne({ slug: collegeSlug });
      if (college) {
        targetCollegeId = college._id;
      }
    }

    // Build tenant-scoped query
    const query = {
      $or: [{ email: normalizedEmail }, { email: credential }, { studentId: credential }],
    };

    // Hard Rule: If college context is present, ALWAYS scope by collegeId
    if (targetCollegeId) {
      query.collegeId = targetCollegeId;
    }

    const user = await User.findOne(query).select('+password +mfaSecret +activationTokenHash');

    if (!user) {
      await consumeFailedLogin(req);
      return next(new AppError('Invalid credentials.', 401));
    }

    // Hard Rule: Unactivated bulk-uploaded accounts cannot log in with any password until activated
    if (user.activationTokenHash && !user.password) {
      await consumeFailedLogin(req);
      return next(
        new AppError(
          'Your account has not been activated yet. Please check your email for your single-use activation link.',
          400
        )
      );
    }

    if (!user.isActive || user.status === 'disabled') {
      await consumeFailedLogin(req);
      return next(new AppError('Your account has been deactivated.', 401));
    }

    if (user.status === 'inactive') {
      await consumeFailedLogin(req);
      return next(
        new AppError(
          'Your student account is currently inactive. Please contact your college administrator.',
          401
        )
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await consumeFailedLogin(req);
      return next(new AppError('Invalid credentials.', 401));
    }

    // TOTP MFA verification for enabled users or college-admin accounts
    if (user.isMfaEnabled && user.mfaSecret) {
      if (!totpCode) {
        return res.status(401).json({
          success: false,
          mfaRequired: true,
          message: 'Multi-factor authentication code required.',
        });
      }

      const speakeasy = require('speakeasy');
      const isValidTotp = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: totpCode,
        window: 2,
      });

      if (!isValidTotp) {
        await consumeFailedLogin(req);
        return next(new AppError('Invalid MFA verification code.', 401));
      }
    }

    await resetFailedLogins(req);

    const deviceInfo = req.headers['user-agent'] || 'Web Browser';
    const { accessToken, refreshToken } = await sessionService.createSession({ user, deviceInfo });

    setRefreshTokenCookie(res, refreshToken, req);

    res.json({
      success: true,
      user: {
        _id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
        isMfaEnabled: !!user.isMfaEnabled,
      },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token & rotate refresh token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res, next) => {
  try {
    const clientToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!clientToken) {
      return next(new AppError('No refresh token provided.', 401));
    }

    const deviceInfo = req.headers['user-agent'] || 'Web Browser';

    try {
      const result = await sessionService.rotateSession(clientToken, deviceInfo);

      setRefreshTokenCookie(res, result.refreshToken, req);

      res.json({
        success: true,
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (sessionErr) {
      clearRefreshTokenCookie(res, req);
      throw sessionErr;
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & invalidate refresh token
// @route   POST /api/auth/logout
// @access  Public / Private
const logoutUser = async (req, res, next) => {
  try {
    const clientToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const allDevices = req.body?.allDevices === true;

    if (allDevices && (req.user?._id || req.user?.id)) {
      const userId = req.user._id || req.user.id;
      await sessionService.revokeAllSessionsForUser(userId);
    } else if (clientToken) {
      await sessionService.revokeSession(clientToken);
    } else if (req.user?._id || req.user?.id) {
      const userId = req.user._id || req.user.id;
      await sessionService.revokeAllSessionsForUser(userId);
    }

    clearRefreshTokenCookie(res, req);

    res.json({
      success: true,
      message: allDevices ? 'Logged out of all devices successfully.' : 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate(
      'collegeId',
      'name code logoUrl status isActive'
    );
    if (!user) {
      return next(new AppError('User not found.', 404));
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Setup TOTP MFA for user
// @route   POST /api/auth/mfa/setup
// @access  Private
const setupMfa = async (req, res, next) => {
  try {
    const speakeasy = require('speakeasy');
    const QRCode = require('qrcode');

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `BookBuddy (${user.email})`,
      issuer: 'BookBuddy',
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    user.mfaSecret = secret.base32;
    await user.save();

    res.json({
      success: true,
      secret: secret.base32,
      qrCodeUrl,
      message: 'Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.).',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify TOTP MFA and enable it on user account
// @route   POST /api/auth/mfa/verify
// @access  Private
const verifyMfa = async (req, res, next) => {
  try {
    const { totpCode } = req.body;
    if (!totpCode) {
      return next(new AppError('TOTP verification code is required.', 400));
    }

    const user = await User.findById(req.user.id).select('+mfaSecret');
    if (!user || !user.mfaSecret) {
      return next(new AppError('MFA setup missing. Please setup MFA first.', 400));
    }

    const speakeasy = require('speakeasy');
    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode,
      window: 2,
    });

    if (!isValid) {
      return next(new AppError('Invalid verification code.', 400));
    }

    user.isMfaEnabled = true;
    await user.save();

    res.json({
      success: true,
      message: 'MFA enabled successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getUserProfile,
  setupMfa,
  verifyMfa,
};
