const User = require('../models/User');
const College = require('../models/College');
const StudentJoinRequest = require('../models/StudentJoinRequest');
const AppError = require('../utils/AppError');
const { getAuthCookieOptions } = require('../utils/cookieOptions');
const sessionService = require('../services/sessionService');
const {
  normalizeEmail,
  normalizeStudentId,
  normalizeRole,
  normalizeIdentity,
  ROLES,
} = require('@bookbuddy/shared');

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

    const effectiveRole = normalizeRole(role || ROLES.STUDENT);

    if ([ROLES.COLLEGE_ADMIN, ROLES.SUPER_ADMIN].includes(effectiveRole)) {
      return next(new AppError('Public registration of administrative roles is forbidden.', 403));
    }

    if (effectiveRole === ROLES.STUDENT && (collegeId || normalizedStudentId)) {
      if (!collegeId) {
        return next(
          new AppError('College selection is required. Please select your institution.', 400)
        );
      }
      const college = await College.findById(collegeId);
      if (!college || !college.isActive) {
        return next(new AppError('The specified college is inactive or does not exist.', 400));
      }
    } else {
      collegeId = null;
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedStudentId = normalizeStudentId(studentId);
    const targetCollegeId = effectiveRole === ROLES.STUDENT && collegeId ? collegeId : null;
    const isInstitutionalStudent = Boolean(targetCollegeId && effectiveRole === ROLES.STUDENT);

    // Roster reconciliation: If college student, check for pre-uploaded roster record
    // matching BOTH studentId and email exactly (no fuzzy/name-only matching) with unactivated status
    if (targetCollegeId && normalizedStudentId && normalizedEmail) {
      const rosterUser = await User.findOne({
        collegeId: targetCollegeId,
        studentId: normalizedStudentId,
        email: normalizedEmail,
        $or: [
          { mustChangePasswordOnNextLogin: true },
          { status: 'invited' },
          { status: 'unactivated' },
        ],
      });

      if (rosterUser) {
        // Auto-activate immediately
        rosterUser.password = password;
        if (name && name.trim()) {
          rosterUser.name = name.trim();
        }
        rosterUser.role = 'student';
        rosterUser.status = 'active';
        rosterUser.membershipStatus = 'active';
        rosterUser.isEmailVerified = true;
        rosterUser.mustChangePasswordOnNextLogin = false;
        rosterUser.activationTokenHash = null;
        rosterUser.activationTokenExpiresAt = null;

        await rosterUser.save();

        const logger = require('../utils/logger');
        logger.info(
          `[DB WRITE CONFIRMED] Model: User | _id: ${rosterUser._id} | email: ${rosterUser.email} | collegeId: ${rosterUser.collegeId} | role: student | status: active | auto-activated: true`
        );

        const deviceInfo = req.headers['user-agent'] || 'Web Browser';
        const { accessToken, refreshToken } = await sessionService.createSession({
          user: rosterUser,
          deviceInfo,
        });

        setRefreshTokenCookie(res, refreshToken, req);

        return res.status(201).json({
          success: true,
          message: 'Account matched with campus roster and auto-activated successfully.',
          user: {
            _id: rosterUser._id,
            studentId: rosterUser.studentId,
            name: rosterUser.name,
            email: rosterUser.email,
            role: rosterUser.role,
            collegeId: rosterUser.collegeId ?? null,
          },
          accessToken,
          isAutoActivated: true,
        });
      }
    }

    const orConditions = [{ email: normalizedEmail }];
    if (targetCollegeId && normalizedStudentId) {
      orConditions.push({ collegeId: targetCollegeId, studentId: normalizedStudentId });
    } else if (normalizedStudentId) {
      orConditions.push({ studentId: normalizedStudentId });
    }

    const userExists = await User.findOne({ $or: orConditions });
    if (userExists) {
      return next(
        new AppError('User with this email or Student ID already exists for this college.', 400)
      );
    }

    // Task 7: If no roster match is found for a College Student, create a StudentJoinRequest (pending)
    // instead of an active account. Zero tenant dashboard access until approved by college admin.
    if (isInstitutionalStudent) {
      const pendingRequest = await StudentJoinRequest.findOne({
        collegeId: targetCollegeId,
        $or: [{ email: normalizedEmail }, { studentId: normalizedStudentId }],
        status: 'pending',
      });

      if (pendingRequest) {
        return next(
          new AppError(
            'A registration request for this student ID or email is already pending review by your college administrator.',
            400
          )
        );
      }

      const argon2 = require('argon2');
      const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });

      const targetCollege = await College.findById(targetCollegeId).select('name shortName');

      const joinRequest = await StudentJoinRequest.create({
        collegeId: targetCollegeId,
        studentId: normalizedStudentId,
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        status: 'pending',
      });

      const logger = require('../utils/logger');
      logger.info(
        `[DB WRITE CONFIRMED] Model: StudentJoinRequest | _id: ${joinRequest._id} | email: ${joinRequest.email} | collegeId: ${joinRequest.collegeId} | status: pending`
      );

      return res.status(201).json({
        success: true,
        requiresApproval: true,
        status: 'pending',
        message: 'Join request submitted. Awaiting college administrator approval.',
        data: {
          requestId: joinRequest._id,
          studentId: joinRequest.studentId,
          name: joinRequest.name,
          email: joinRequest.email,
          collegeId: joinRequest.collegeId,
          collegeName: targetCollege?.name || 'Your Institution',
          status: 'pending',
          submittedAt: joinRequest.submittedAt,
        },
      });
    }

    const effectiveStudentId =
      normalizedStudentId || (effectiveRole === 'general' ? undefined : `stu_${Date.now()}`);

    const user = await User.create({
      studentId: effectiveStudentId,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: effectiveRole,
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
        collegeId: user.collegeId ?? null,
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
    const normalizedIdentifier = normalizeIdentity(email || studentId);
    const effectiveSlug = req.subdomainTenant
      ? req.subdomainTenant.slug
      : collegeSlug || req.headers['x-college-slug'];
    let targetCollegeId = req.subdomainTenant
      ? req.subdomainTenant._id
      : reqCollegeId || req.headers['x-college-id'];

    // Resolve target collegeId if collegeSlug is provided in request context and not already resolved
    if (!targetCollegeId && effectiveSlug) {
      const college = await College.findOne({ slug: effectiveSlug });
      if (college) {
        targetCollegeId = college._id;
      }
    }

    // Build query matching only normalized fields against compound indexes {collegeId, email} / {collegeId, studentId}
    const query = {
      $or: [{ email: normalizedIdentifier }, { studentId: normalizedIdentifier }],
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
      const logger = require('../utils/logger');
      logger.warn(
        `[Auth Comparison] Password mismatch for user id: ${user._id} | email: ${user.email}`
      );
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
        mustChangePasswordOnNextLogin: Boolean(user.mustChangePasswordOnNextLogin),
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

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new AppError('Current password and new password are required.', 400));
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return next(new AppError('New password must be at least 8 characters long.', 400));
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return next(new AppError('Current password does not match.', 400));
    }

    user.password = newPassword;
    user.mustChangePasswordOnNextLogin = false;
    if (user.status === 'invited') {
      user.status = 'active';
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Your account is now active.',
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
  changePassword,
};
