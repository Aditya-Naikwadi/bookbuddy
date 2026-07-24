const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const requireIdempotency = require('../middlewares/idempotency');
const { createCheckoutSession, handlePaymentWebhook } = require('../controllers/paymentController');

// Webhook endpoint (signature verified internally in controller)
router.post('/webhook', handlePaymentWebhook);

// Checkout session creation endpoints (enforce idempotency)
router.post('/checkout-session', protect, requireIdempotency, createCheckoutSession);
router.post(
  '/fines/:id/create-checkout-session',
  protect,
  requireIdempotency,
  createCheckoutSession
);

module.exports = router;
