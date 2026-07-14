const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

// @desc    Get Patron Card Data (including QR Payload)
// @route   GET /api/patron-card/me
// @access  Private
const getMyPatronCard = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Create a signed QR payload that the librarian scanner can verify
  const qrPayload = jwt.sign(
    { studentId: user.studentId, _id: user._id, type: 'patron-card' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({
    success: true,
    data: {
      studentId: user.studentId,
      name: user.name,
      avatar: user.avatar,
      membershipStatus: user.membershipStatus,
      validTill: user.validTill,
      qrCodeData: qrPayload,
    },
  });
});

module.exports = {
  getMyPatronCard,
};
