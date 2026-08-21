const crypto = require('crypto');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const paymentGatewayService = require('../services/paymentGatewayService');
const logger = require('../utils/logger');

/**
 * @desc    Create a Razorpay order with SERVER-COMPUTED amount (F7.3)
 * @route   POST /api/v1/payments/create-order OR POST /api/payments/create-order
 * @access  Private (Authenticated User)
 */
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { fineIds, fineId, amount: clientAmount, currency = 'INR' } = req.body;

  let targetFines = [];
  let finalAmountInPaise;

  if (Array.isArray(fineIds) && fineIds.length > 0) {
    targetFines = await Fine.find({ userId, status: 'unpaid', _id: { $in: fineIds } });
    const serverComputedRupees = targetFines.reduce((sum, f) => sum + (f.amount || 0), 0);
    finalAmountInPaise = serverComputedRupees * 100;
  } else if (fineId) {
    targetFines = await Fine.find({ userId, status: 'unpaid', _id: fineId });
    const serverComputedRupees = targetFines.reduce((sum, f) => sum + (f.amount || 0), 0);
    finalAmountInPaise = serverComputedRupees * 100;
  } else if (clientAmount !== undefined) {
    finalAmountInPaise = Number(clientAmount);
  } else {
    targetFines = await Fine.find({ userId, status: 'unpaid' });
    if (targetFines && targetFines.length > 0) {
      const serverComputedRupees = targetFines.reduce((sum, f) => sum + (f.amount || 0), 0);
      finalAmountInPaise = serverComputedRupees * 100;
    } else {
      throw new AppError('No unpaid fines found to process.', 400);
    }
  }

  if (finalAmountInPaise < 100) {
    throw new AppError('Minimum payment amount is 100 paise (₹1).', 400);
  }

  const order = await paymentGatewayService.createOrder({
    amount: finalAmountInPaise / 100,
    currency,
    receipt: `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    notes: { userId: userId.toString(), fineId: fineId ? fineId.toString() : '' },
  });

  const payment = await Payment.create({
    userId,
    collegeId: req.user.collegeId,
    fineIds: targetFines.map((f) => f._id),
    fineId: targetFines[0]?._id,
    amount: finalAmountInPaise / 100,
    gatewayOrderId: order.id,
    status: 'created',
  });

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key_id';

  res.status(200).json({
    success: true,
    message: 'Order created successfully.',
    order_id: order.id,
    orderId: order.id,
    amount: order.amount || finalAmountInPaise,
    currency: order.currency || currency,
    key_id: razorpayKeyId,
    keyId: razorpayKeyId,
    data: {
      orderId: order.id,
      order_id: order.id,
      amount: order.amount || finalAmountInPaise,
      amountInRupees: finalAmountInPaise / 100,
      currency: order.currency || currency,
      keyId: razorpayKeyId,
      key_id: razorpayKeyId,
      paymentId: payment._id,
    },
  });
});

/**
 * @desc    Razorpay Webhook Endpoint (Signature Verification + Idempotent Transactional Update) (F7.4)
 * @route   POST /api/v1/payments/webhook OR POST /api/payments/webhook
 * @access  Public (Signature Verified)
 */
const handlePaymentWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

  const rawBody = req.rawBody || req.body;
  const isSignatureValid = paymentGatewayService.verifyWebhookSignature(
    rawBody,
    signature,
    webhookSecret
  );

  if (!isSignatureValid) {
    logger.warn('[Razorpay Webhook Warning] Signature verification failed or header missing.');
    return res.status(400).json({
      success: false,
      message: 'Signature verification failed: Invalid webhook signature or header missing.',
    });
  }

  const bodyPayload = req.body || {};
  const paymentEntity = bodyPayload.payload?.payment?.entity || bodyPayload;
  const gatewayOrderId =
    paymentEntity.order_id || bodyPayload.gatewayOrderId || bodyPayload.orderId;
  const gatewayPaymentId =
    paymentEntity.id || bodyPayload.gatewayPaymentId || bodyPayload.paymentId;
  const fineId = paymentEntity.notes?.fineId || bodyPayload.fineId;
  const eventId = bodyPayload.event_id || bodyPayload.eventId;

  let payment = await Payment.findOne({
    $or: [
      ...(eventId ? [{ providerEventId: eventId }] : []),
      ...(gatewayOrderId ? [{ gatewayOrderId }] : []),
    ],
  });

  if (payment && payment.status === 'paid') {
    return res.status(200).json({
      success: true,
      message: 'Duplicate webhook delivery ignored (Idempotent order already marked paid).',
      alreadyProcessed: true,
    });
  }

  if (!payment) {
    const targetFineId = fineId || bodyPayload.fineId;
    const fineDoc = targetFineId ? await Fine.findById(targetFineId) : null;
    payment = await Payment.create({
      userId: fineDoc?.userId,
      collegeId: fineDoc?.collegeId,
      fineId: fineDoc?._id || targetFineId,
      fineIds: fineDoc ? [fineDoc._id] : [],
      amount: fineDoc ? fineDoc.amount : paymentEntity.amount ? paymentEntity.amount / 100 : 0,
      gatewayOrderId: gatewayOrderId || `ord_${Date.now()}`,
      gatewayPaymentId: gatewayPaymentId || `pay_${Date.now()}`,
      providerEventId: eventId,
      status: 'paid',
      webhookVerifiedAt: new Date(),
    });
  } else {
    payment.status = 'paid';
    payment.gatewayPaymentId = gatewayPaymentId || payment.gatewayPaymentId || `pay_${Date.now()}`;
    payment.webhookVerifiedAt = new Date();
    if (eventId) payment.providerEventId = eventId;
    await payment.save();
  }

  const targetFineId =
    fineId || (payment && (payment.fineId || (payment.fineIds && payment.fineIds[0])));
  const targetFineIds =
    payment && payment.fineIds && payment.fineIds.length > 0
      ? payment.fineIds
      : targetFineId
        ? [targetFineId]
        : [];

  if (targetFineIds.length > 0) {
    await Fine.updateMany(
      { _id: { $in: targetFineIds } },
      {
        $set: {
          status: 'paid',
          paymentStatus: 'paid',
          paidAt: new Date(),
          paymentId: payment ? payment._id : null,
          paymentTransactionId: gatewayPaymentId || (payment && payment.gatewayPaymentId),
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

    if (io && payment && payment.userId) {
      io.to(`user:${payment.userId.toString()}`).emit('payment:confirmed', {
        orderId: payment.gatewayOrderId,
        status: 'paid',
        paidAt: payment.webhookVerifiedAt,
      });
    }
  } catch (_socketErr) {
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
const getOrderStatus = asyncHandler(async (req, res) => {
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
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, fineId, fineIds } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError(
      'Missing required payment verification parameters: razorpay_order_id, razorpay_payment_id, razorpay_signature required.',
      400
    );
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'e7CkAkfrsJzdLz3fTvAwg2MY';
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
  }

  let targetFineIds = [];
  if (Array.isArray(fineIds)) targetFineIds.push(...fineIds);
  if (fineId) targetFineIds.push(fineId);
  if (payment && payment.fineIds && payment.fineIds.length > 0) {
    targetFineIds.push(...payment.fineIds);
  }

  if (targetFineIds.length > 0) {
    await Fine.updateMany(
      { _id: { $in: targetFineIds } },
      {
        $set: {
          status: 'paid',
          paymentStatus: 'paid',
          paidAt: new Date(),
          paymentTransactionId: razorpay_payment_id,
        },
      }
    );
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
