const crypto = require('crypto');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');

/**
 * @desc    Create a Razorpay/Stripe checkout session for a library fine
 * @route   POST /api/fines/:id/create-checkout-session
 * @access  Private (Student)
 */
const createCheckoutSession = async (req, res, next) => {
  try {
    const fineId = req.params.id || req.body.fineId;
    const userId = req.user.id || req.user._id;

    const fine = await Fine.findOne({ _id: fineId, userId });
    if (!fine) {
      throw new AppError('Fine record not found or access denied.', 404);
    }

    if (fine.status === 'paid') {
      throw new AppError('This fine has already been paid.', 400);
    }

    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key';

    res.json({
      success: true,
      data: {
        orderId,
        fineId: fine._id,
        amount: fine.amount,
        currency: 'INR',
        keyId,
        checkoutUrl: `https://checkout.razorpay.com/v1/checkout.js`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Razorpay Webhook Handler for Payment Verification & Reconciliation
 * @route   POST /api/payments/webhook
 * @access  Public (Webhook endpoint protected via HMAC Signature Verification)
 */
const handlePaymentWebhook = async (req, res, next) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_key_123';
    const receivedSignature = req.headers['x-razorpay-signature'];

    if (!receivedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature: Signature header missing',
      });
    }

    // Compute expected HMAC SHA256 signature
    const payloadStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadStr)
      .digest('hex');

    if (receivedSignature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature: Signature verification failed',
      });
    }

    // Extract event details
    const eventId =
      req.body.event_id ||
      req.body.eventId ||
      `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const paymentEntity = req.body.payload?.payment?.entity || req.body;
    const paymentId =
      paymentEntity.id ||
      req.body.paymentId ||
      `pay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const fineId = paymentEntity.notes?.fineId || req.body.fineId;

    if (!fineId) {
      return res.status(400).json({
        success: false,
        message: 'Missing fineId reference in webhook payload',
      });
    }

    // IDEMPOTENCY CHECK: Ensure a fine is only marked paid once per unique event / payment ID
    const existingPayment = await Payment.findOne({
      $or: [{ providerSessionId: paymentId }, { providerEventId: eventId }],
    });

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: 'Duplicate webhook event ignored (Idempotency verified)',
        alreadyProcessed: true,
      });
    }

    // Mark Fine as Paid & Create Payment record
    const fine = await Fine.findById(fineId);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: 'Fine record referenced in webhook payload not found',
      });
    }

    if (fine.status !== 'paid') {
      fine.status = 'paid';
      fine.paidAt = new Date();
      await fine.save();
    }

    await Payment.create({
      fineId: fine._id,
      userId: fine.userId,
      amount: fine.amount || paymentEntity.amount / 100 || 0,
      providerSessionId: paymentId,
      providerEventId: eventId,
      status: 'completed',
      signatureVerified: true,
      paidAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified and fine marked as paid successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        message: 'Duplicate webhook event ignored at DB level (Idempotency verified)',
        alreadyProcessed: true,
      });
    }
    next(error);
  }
};

module.exports = {
  createCheckoutSession,
  handlePaymentWebhook,
};
