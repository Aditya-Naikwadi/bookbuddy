const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const requireIdempotency = require('../middlewares/idempotency');
const {
  createOrder,
  verifyPayment,
  getOrderStatus,
  createCheckoutSession,
  handlePaymentWebhook,
} = require('../controllers/paymentController');

// Webhook endpoint (signature verified internally in controller)
router.post('/webhook', handlePaymentWebhook);

// Razorpay Order Creation & Payment Verification
router.post('/create-order', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.get('/:orderId/status', protect, getOrderStatus);

// Checkout session creation endpoints (enforce idempotency)
router.post('/checkout-session', protect, requireIdempotency, createCheckoutSession);
router.post(
  '/fines/:id/create-checkout-session',
  protect,
  requireIdempotency,
  createCheckoutSession
);

module.exports = router;
