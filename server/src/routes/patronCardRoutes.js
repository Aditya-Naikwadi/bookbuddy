const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');

// @desc    Get Patron Card Data (including QR Payload)
// @route   GET /api/patron-card/me
// @access  Private
const getPatronCard = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Create a signed QR payload that the librarian scanner can verify
  const qrPayload = jwt.sign(
    { studentId: user.studentId, _id: user._id, type: 'patron-card' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.json({
    success: true,
    patronCard: {
      studentId: user.studentId,
      name: user.name,
      avatar: user.avatar,
      membershipStatus: user.membershipStatus,
      validTill: user.validTill,
      qrCodeData: qrPayload,
    }
  });
});

router.get('/me', protect, getPatronCard);

module.exports = router;
