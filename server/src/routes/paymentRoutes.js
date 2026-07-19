const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { createCheckoutSession, handlePaymentWebhook } = require('../controllers/paymentController');

// Webhook endpoint (signature verified internally in controller)
router.post('/webhook', handlePaymentWebhook);

// Checkout session creation endpoint
router.post('/checkout-session', protect, createCheckoutSession);
router.post('/fines/:id/create-checkout-session', protect, createCheckoutSession);

module.exports = router;
