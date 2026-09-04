const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { generateAccessToken } = require('../utils/token');

/**
 * GET /api/v1/auth/activate-token/verify?token=<rawToken>
 * Public verification endpoint for token validation before displaying password setup form.
 */
exports.verifyActivationToken = asyncHandler(async (req, res, next) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return next(new AppError('Activation token is required', 400));
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({ activationTokenHash: tokenHash }).populate(
    'collegeId',
    'name slug logo code'
  );

  if (!user) {
    return next(
      new AppError(
        'Invalid or already consumed activation token. Please request a new activation link.',
        400
      )
    );
  }

  if (user.activationTokenExpiresAt && user.activationTokenExpiresAt < new Date()) {
    return next(
      new AppError(
        'This activation link has expired. Please contact your college administrator to issue a new activation link.',
        400
      )
    );
  }

  res.status(200).json({
    success: true,
    student: {
      name: user.name,
      studentId: user.studentId,
      email: user.email,
      program: user.program,
      year: user.year,
      college: user.collegeId,
    },
  });
});

/**
 * POST /api/v1/auth/activate-account
 * Consumes raw token, sets student's password, invalidates token (single-use), issues JWT.
 */
exports.activateAccount = asyncHandler(async (req, res, next) => {
  const { token, newPassword } = req.body;

  if (!token || typeof token !== 'string') {
    return next(new AppError('Activation token is required', 400));
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return next(new AppError('Password must be at least 8 characters long', 400));
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({ activationTokenHash: tokenHash });

  if (!user) {
    return next(
      new AppError('Invalid or already consumed activation token. Account activation failed.', 400)
    );
  }

  if (user.activationTokenExpiresAt && user.activationTokenExpiresAt < new Date()) {
    return next(
      new AppError(
        'This activation link has expired. Please contact your college administrator for a new activation link.',
        400
      )
    );
  }

  // Set new password (triggers Argon2id pre-save hook in User model)
  user.password = newPassword;
  user.status = 'active';
  user.isEmailVerified = true;

  // Single-use token invalidation
  user.activationTokenHash = null;
  user.activationTokenExpiresAt = null;

  await user.save();

  // Generate signed JWT access token for immediate seamless login
  const accessToken = generateAccessToken({
    id: user._id,
    sub: user._id,
    role: user.role,
    collegeId: user.collegeId,
  });

  res.status(200).json({
    success: true,
    message: 'Your account has been activated successfully! You are now logged in.',
    token: accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      studentId: user.studentId,
      role: user.role,
      collegeId: user.collegeId,
    },
  });
});
