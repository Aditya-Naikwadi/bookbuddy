const crypto = require('crypto');
const Razorpay = require('razorpay');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const config = require('../config');

// Lazy-instantiated Razorpay SDK instance
const getRazorpayInstance = () => {
  const key_id = config.razorpayKeyId;
  const key_secret = config.razorpayKeySecret;
  return new Razorpay({ key_id, key_secret });
};

/**
 * @desc    Create a Razorpay order
 * @route   POST /api/create-order, POST /api/v1/payments/create-order
 * @access  Private / Public (validated)
 */
const createOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', receipt, fineId } = req.body;

    let amountInPaise = amount;

    // If fineId is provided, resolve fine record to determine amount if not specified
    if (fineId) {
      const fine = await Fine.findById(fineId);
      if (!fine) {
        return next(new AppError('Fine record not found.', 404));
      }
      if (fine.status === 'paid') {
        return next(new AppError('This fine has already been paid.', 400));
      }
      if (!amountInPaise) {
        amountInPaise = Math.round(fine.amount * 100);
      }
    }

    // Minimum amount validation: 100 paise (₹1)
    if (!amountInPaise || amountInPaise < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum order amount must be at least 100 paise (₹1).',
      });
    }

    const key_id = process.env.RAZORPAY_KEY_ID || config.razorpayKeyId || 'rzp_test_TOm6pPV3QhF4Vr';

    try {
      const razorpay = getRazorpayInstance();
      const options = {
        amount: Math.round(amountInPaise),
        currency: currency.toUpperCase(),
        receipt: receipt || `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        notes: {
          fineId: fineId || '',
        },
      };

      const order = await razorpay.orders.create(options);

      return res.status(200).json({
        success: true,
        order_id: order.id,
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id,
        fineId: fineId || null,
        data: {
          orderId: order.id,
          fineId: fineId || null,
          amount: order.amount,
          currency: order.currency,
          keyId: key_id,
          checkoutUrl: 'https://checkout.razorpay.com/v1/checkout.js',
        },
      });
    } catch (apiError) {
      // Handle Razorpay API errors (return 500)
      return res.status(500).json({
        success: false,
        message: apiError.message || 'Razorpay order creation failed.',
        error: apiError.error || apiError,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Razorpay payment signature
 * @route   POST /api/verify-payment, POST /api/v1/payments/verify-payment
 * @access  Private / Public (validated)
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, fineId } = req.body;

    // Missing fields check: return 400
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required payment verification parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
      });
    }

    const key_secret = config.razorpayKeySecret;

    // HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', key_secret).update(payload).digest('hex');

    // Signature mismatch: return 400, do NOT mark as paid
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Verification failed.',
      });
    }

    // Signature verified successfully -> process database update if fineId provided
    if (fineId) {
      const fine = await Fine.findById(fineId);
      if (fine && fine.status !== 'paid') {
        fine.status = 'paid';
        fine.paymentStatus = 'paid';
        fine.paymentTransactionId = razorpay_payment_id;
        fine.paidAt = new Date();
        await fine.save();
      }

      await Payment.create({
        fineId,
        userId: fine ? fine.userId : req.user?.id || null,
        amount: fine ? fine.amount : 0,
        providerSessionId: razorpay_payment_id,
        providerEventId: razorpay_order_id,
        status: 'completed',
        signatureVerified: true,
        paidAt: new Date(),
      }).catch(() => null); // Prevent duplicate key error on payment log re-runs
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully.',
      razorpay_payment_id,
      razorpay_order_id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a Razorpay/Stripe checkout session for a library fine (Legacy alias)
 * @route   POST /api/fines/:id/create-checkout-session
 * @access  Private (Student)
 */
const createCheckoutSession = async (req, res, next) => {
  req.body.fineId = req.params.id || req.body.fineId;
  return createOrder(req, res, next);
};

/**
 * @desc    Razorpay Webhook Handler for Payment Verification & Reconciliation
 * @route   POST /api/payments/webhook
 * @access  Public (Webhook endpoint protected via HMAC Signature Verification)
 */
const handlePaymentWebhook = async (req, res, next) => {
  try {
    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      process.env.RAZORPAY_KEY_SECRET ||
      'test_webhook_secret_key_123';
    const receivedSignature = req.headers['x-razorpay-signature'];

    if (!receivedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature: Signature header missing',
      });
    }

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
  createOrder,
  verifyPayment,
  createCheckoutSession,
  handlePaymentWebhook,
};
