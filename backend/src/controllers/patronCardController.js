const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { generatePatronToken, verifyPatronToken } = require('../utils/patronTokenUtil');

// @desc    Get Patron Card Data (including initial QR Payload)
// @route   GET /api/patron-card/me
// @access  Private
const getMyPatronCard = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const { token, expiresAt } = generatePatronToken(user._id, user.studentId);

  res.json({
    success: true,
    data: {
      studentId: user.studentId,
      name: user.name,
      avatar: user.avatar,
      membershipStatus: user.membershipStatus,
      validTill: user.validTill,
      qrCodeData: token,
      expiresAt,
    },
  });
});

// @desc    Get 30-second Rotating Gate Verification Token
// @route   GET /api/patron-card/token
// @access  Private
const getRotatingToken = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const { token, expiresAt } = generatePatronToken(user._id, user.studentId);

  res.json({
    success: true,
    data: {
      token,
      expiresAt,
      studentId: user.studentId,
    },
  });
});

// @desc    Verify Scanned Patron Card Token for Library Gate Access
// @route   POST /api/patron-card/verify
// @access  Public / Gate Scanner
const verifyPatronCardToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    throw new AppError('Verification token is required.', 400);
  }

  const verification = verifyPatronToken(token);

  if (!verification.valid) {
    logger.warn(`Gate Verification Failed: ${verification.reason}`);
    return res.status(400).json({
      success: false,
      message: `Token verification failed: ${verification.reason}`,
      data: { valid: false },
    });
  }

  const user = await User.findById(verification.userId);
  if (!user) {
    logger.warn(`Gate Verification Failed: User ${verification.userId} not found`);
    return res.status(404).json({
      success: false,
      message: 'Student associated with token not found',
      data: { valid: false },
    });
  }

  logger.info(`Gate Verification Success for Student: ${user.studentId} (${user.name})`);

  res.json({
    success: true,
    data: {
      valid: true,
      studentId: user.studentId,
      name: user.name,
      collegeId: user.collegeId,
      membershipStatus: user.membershipStatus,
    },
  });
});

module.exports = {
  getMyPatronCard,
  getRotatingToken,
  verifyPatronCardToken,
};
