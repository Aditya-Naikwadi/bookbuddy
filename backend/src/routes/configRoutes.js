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
      googleClientId:
        process.env.GOOGLE_CLIENT_ID ||
        '404307478076-2oun4gi0qop5pgnc6ndua8auaiqbhf0a.apps.googleusercontent.com',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_bookbuddy_demo',
      apiUrl: '/api/v1',
    },
  });
});

module.exports = router;
