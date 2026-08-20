const crypto = require('crypto');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const paymentGatewayService = require('../services/paymentGatewayService');

/**
 * @desc    Create a Razorpay order with SERVER-COMPUTED amount (F7.3)
 * @route   POST /api/v1/payments/create-order OR POST /api/payments/create-order
 * @access  Private (Authenticated User)
 */
const createOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user.id || req.user._id;
  const { fineIds, fineId } = req.body;

  // Build query to fetch user's unpaid fines
  let query = { userId, status: 'unpaid' };
  if (Array.isArray(fineIds) && fineIds.length > 0) {
    query._id = { $in: fineIds };
  } else if (fineId) {
    query._id = fineId;
  }

  const fines = await Fine.find(query);
  if (!fines || fines.length === 0) {
    throw new AppError('No unpaid fines found to process.', 400);
  }

  // ACCEPTANCE CRITERIA F7.3: The amount is computed server-side from the user's actual
  // outstanding Fine records — any client-supplied amount in req.body is IGNORED ENTIRELY.
  const serverComputedAmount = fines.reduce((sum, fine) => sum + (fine.amount || 0), 0);

  if (serverComputedAmount <= 0) {
    throw new AppError('Calculated fine amount must be greater than zero.', 400);
  }

  // Call paymentGatewayService wrapper to create Razorpay Order
  const order = await paymentGatewayService.createOrder({
    amount: serverComputedAmount,
    currency: 'INR',
    receipt: `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    notes: { userId: userId.toString() },
  });

  // Save Payment document in DB with 'created' status and idempotency gatewayOrderId
  const payment = await Payment.create({
    userId,
    fineIds: fines.map((f) => f._id),
    amount: serverComputedAmount,
    gatewayOrderId: order.id,
    status: 'created',
  });

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key_id';

  res.status(200).json({
    success: true,
    message: 'Order created successfully with server-computed amount.',
    data: {
      orderId: order.id,
      amount: order.amount, // in paise
      amountInRupees: serverComputedAmount,
      currency: order.currency,
      keyId: razorpayKeyId,
      paymentId: payment._id,
    },
  });
});

/**
 * @desc    Razorpay Webhook Endpoint (Signature Verification + Idempotent Transactional Update) (F7.4)
 * @route   POST /api/v1/payments/webhook OR POST /api/payments/webhook
 * @access  Public (Signature Verified)
 */
const handlePaymentWebhook = asyncHandler(async (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

  // 1. Signature Verification
  // ACCEPTANCE CRITERIA F7.4: A webhook with an invalid or missing signature is REJECTED and logged, NEVER processed.
  const rawBody = req.rawBody || req.body;
  const isSignatureValid = paymentGatewayService.verifyWebhookSignature(
    rawBody,
    signature,
    webhookSecret
  );

  if (!isSignatureValid) {
    console.warn('[Razorpay Webhook Warning] Webhook signature verification failed or header missing.');
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook signature: Verification failed or signature header missing.',
    });
  }

  // Extract orderId and paymentId from gateway payload
  const bodyPayload = req.body || {};
  const paymentEntity = bodyPayload.payload?.payment?.entity || bodyPayload;
  const gatewayOrderId = paymentEntity.order_id || bodyPayload.gatewayOrderId || bodyPayload.orderId;
  const gatewayPaymentId = paymentEntity.id || bodyPayload.gatewayPaymentId || bodyPayload.paymentId;

  if (!gatewayOrderId) {
    return res.status(400).json({
      success: false,
      message: 'Missing gatewayOrderId in webhook payload.',
    });
  }

  // 2. Look up Payment document
  const payment = await Payment.findOne({ gatewayOrderId });
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: `Payment record with gatewayOrderId '${gatewayOrderId}' not found.`,
    });
  }

  // 3. Idempotency Check
  // ACCEPTANCE CRITERIA F7.4: A duplicate valid webhook for an already-paid order is a NO-OP, not a double-credit.
  if (payment.status === 'paid') {
    return res.status(200).json({
      success: true,
      message: 'Duplicate webhook delivery ignored (Idempotent order already marked paid).',
      alreadyProcessed: true,
    });
  }

  // 4. Update Payment & Cascade Update Fine records
  payment.status = 'paid';
  payment.gatewayPaymentId = gatewayPaymentId || payment.gatewayPaymentId || `pay_${Date.now()}`;
  payment.webhookVerifiedAt = new Date();
  await payment.save();

  if (payment.fineIds && payment.fineIds.length > 0) {
    await Fine.updateMany(
      { _id: { $in: payment.fineIds } },
      {
        $set: {
          status: 'paid',
          paymentStatus: 'paid',
          paidAt: new Date(),
          paymentId: payment._id,
          paymentTransactionId: gatewayPaymentId,
        },
      }
    );
  }

  // Socket.io push notification upon server/webhook confirmation (F7.5)
  try {
    const socketModule = require('../sockets');
    const io =
      (req.app && typeof req.app.get === 'function' ? req.app.get('io') : null) ||
      (socketModule && typeof socketModule.getIO === 'function' ? socketModule.getIO() : null);

    if (io && payment.userId) {
      io.to(`user:${payment.userId.toString()}`).emit('payment:confirmed', {
        orderId: payment.gatewayOrderId,
        status: 'paid',
        paidAt: payment.webhookVerifiedAt,
      });
    }
  } catch (socketErr) {
    // Non-blocking socket emission
  }

  res.status(200).json({
    success: true,
    message: 'Webhook processed successfully: Payment marked paid and fines reconciled.',
    data: payment,
  });
});

/**
 * @desc    Get order status (Polling endpoint for frontend confirmation) (F7.5)
 * @route   GET /api/v1/payments/:orderId/status OR GET /api/payments/:orderId/status
 * @access  Private
 */
const getOrderStatus = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const payment = await Payment.findOne({ gatewayOrderId: orderId });

  if (!payment) {
    throw new AppError('Payment record not found.', 404);
  }

  res.json({
    success: true,
    data: {
      orderId: payment.gatewayOrderId,
      status: payment.status, // 'created' | 'paid' | 'failed'
      webhookVerifiedAt: payment.webhookVerifiedAt,
      amount: payment.amount,
      fineIds: payment.fineIds,
    },
  });
});

/**
 * @desc    Verify payment signature from client flow
 * @route   POST /api/v1/payments/verify-payment OR POST /api/payments/verify-payment
 * @access  Private
 */
const verifyPayment = asyncHandler(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError(
      'Missing required payment parameters: razorpay_order_id, razorpay_payment_id, razorpay_signature required.',
      400
    );
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'dummy_razorpay_secret_key';
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    throw new AppError('Invalid payment signature. Verification failed.', 400);
  }

  const payment = await Payment.findOne({ gatewayOrderId: razorpay_order_id });
  if (payment && payment.status !== 'paid') {
    payment.status = 'paid';
    payment.gatewayPaymentId = razorpay_payment_id;
    payment.webhookVerifiedAt = new Date();
    await payment.save();

    if (payment.fineIds && payment.fineIds.length > 0) {
      await Fine.updateMany(
        { _id: { $in: payment.fineIds } },
        {
          $set: {
            status: 'paid',
            paymentStatus: 'paid',
            paidAt: new Date(),
            paymentId: payment._id,
            paymentTransactionId: razorpay_payment_id,
          },
        }
      );
    }
  }

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully.',
    data: { orderId: razorpay_order_id, paymentId: razorpay_payment_id },
  });
});

const createCheckoutSession = asyncHandler(async (req, res, next) => {
  return createOrder(req, res, next);
});

module.exports = {
  createOrder,
  handlePaymentWebhook,
  getOrderStatus,
  verifyPayment,
  createCheckoutSession,
};
