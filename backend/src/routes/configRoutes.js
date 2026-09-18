const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/v1/config/public
 * @desc    Get public application configuration for frontend (client IDs, public integration keys)
 * @access  Public
 */
router.get('/public', (req, res) => {
  res.json({
    success: true,
    config: {
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
      apiUrl: '/api/v1',
    },
  });
});

module.exports = router;
