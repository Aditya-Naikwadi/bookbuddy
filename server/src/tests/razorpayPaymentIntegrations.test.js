const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_razorpay_test';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_key_12345';
process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_key_secret_12345';

const app = require('../app');
const Payment = require('../models/Payment');
const Fine = require('../models/Fine');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');
const paymentGatewayService = require('../services/paymentGatewayService');

// Mock Razorpay SDK orders.create call to prevent live network call in CI
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => {
    return {
      orders: {
        create: jest.fn().mockImplementation((options) => {
          return Promise.resolve({
            id: `order_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            entity: 'order',
            amount: options.amount,
            currency: options.currency || 'INR',
            receipt: options.receipt,
            status: 'created',
          });
        }),
      },
    };
  });
});

describe('Razorpay Integration & Security Audit (F7.2, F7.3, F7.4)', () => {
  let college, student;
  let tokenStudent;
  let fine1, fine2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await Payment.deleteMany({});
    await Fine.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await Payment.syncIndexes();

    college = await College.create({
      name: 'Razorpay Test College',
      shortName: 'RZP',
      code: `RZP_${Date.now()}`,
    });

    student = await User.create({
      studentId: `STU_RZP_${Date.now()}`,
      name: 'Razorpay Student',
      email: `stu_rzp_${Date.now()}@rzp.edu`,
      password: 'password123',
      role: 'student',
      collegeId: college._id,
    });

    tokenStudent = generateAccessToken(student);
  });

  beforeEach(async () => {
    await Payment.deleteMany({});
    await Fine.deleteMany({});

    fine1 = await Fine.create({
      collegeId: college._id,
      userId: student._id,
      loanId: new mongoose.Types.ObjectId(),
      overdueDays: 5,
      amount: 50.0,
      status: 'unpaid',
    });

    fine2 = await Fine.create({
      collegeId: college._id,
      userId: student._id,
      loanId: new mongoose.Types.ObjectId(),
      overdueDays: 10,
      amount: 75.0,
      status: 'unpaid',
    });
  });

  afterAll(async () => {
    await Payment.deleteMany({});
    await Fine.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await mongoose.connection.close();
  });

  describe('F7.2 — paymentGatewayService in isolation (Mocked Network)', () => {
    it('Acceptance Criteria: service functions are unit-testable in isolation without live network call', async () => {
      const order = await paymentGatewayService.createOrder({
        amount: 100, // ₹100
        currency: 'INR',
        receipt: 'rcpt_unit_test',
      });

      expect(order.id).toBeDefined();
      expect(order.amount).toBe(10000); // 10000 paise

      // Test webhook signature verification
      const rawPayload = JSON.stringify({ event: 'payment.captured' });
      const validSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      expect(
        paymentGatewayService.verifyWebhookSignature(
          rawPayload,
          validSig,
          process.env.RAZORPAY_WEBHOOK_SECRET
        )
      ).toBe(true);
      expect(
        paymentGatewayService.verifyWebhookSignature(
          rawPayload,
          'invalid_sig',
          process.env.RAZORPAY_WEBHOOK_SECRET
        )
      ).toBe(false);
    });
  });

  describe('F7.3 — POST /api/v1/payments/create-order (Server-Computed Amount)', () => {
    it('Acceptance Criteria: manipulated client request specifying lower amount is IGNORED entirely', async () => {
      const manipulatedAmount = 1.0; // Client attempts to pay ₹1 instead of ₹125 (50 + 75)

      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${tokenStudent}`)
        .send({
          amount: manipulatedAmount, // Attack Payload
          fineIds: [fine1._id.toString(), fine2._id.toString()],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // ACCEPTANCE CRITERIA: Amount returned to gateway is ₹125 (12500 paise), NOT ₹1 (100 paise)
      expect(res.body.data.amountInRupees).toBe(125.0);
      expect(res.body.data.amount).toBe(12500);

      // Verify Payment document in DB stored server-computed amount of 125
      const paymentDoc = await Payment.findById(res.body.data.paymentId);
      expect(paymentDoc.amount).toBe(125.0);
      expect(paymentDoc.amount).not.toBe(manipulatedAmount);
    });
  });

  describe('F7.4 — Webhook Signature Verification & Idempotent Transactional Update', () => {
    it('Acceptance Criteria: webhook with invalid/missing signature is REJECTED and logged, never processed', async () => {
      const orderRes = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${tokenStudent}`)
        .send({});

      const orderId = orderRes.body.data.orderId;

      // Webhook payload with missing signature header
      const resNoSig = await request(app)
        .post('/api/v1/payments/webhook')
        .send({
          payload: {
            payment: {
              entity: {
                id: 'pay_test_no_sig',
                order_id: orderId,
              },
            },
          },
        });

      expect(resNoSig.statusCode).toBe(400);
      expect(resNoSig.body.message).toContain('Invalid webhook signature');

      // Verify Payment doc status remains 'created' (not paid)
      const paymentDoc = await Payment.findOne({ gatewayOrderId: orderId });
      expect(paymentDoc.status).toBe('created');

      // Verify fines remain 'unpaid'
      const f1 = await Fine.findById(fine1._id);
      expect(f1.status).toBe('unpaid');
    });

    it('Acceptance Criteria: valid webhook marks payment paid & cascade updates fines; duplicate webhook is a no-op', async () => {
      const orderRes = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${tokenStudent}`)
        .send({});

      const orderId = orderRes.body.data.orderId;
      const gatewayPaymentId = `pay_valid_${Date.now()}`;

      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: gatewayPaymentId,
              order_id: orderId,
              amount: 12500,
            },
          },
        },
      };

      const payloadStr = JSON.stringify(webhookPayload);
      const validSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(payloadStr)
        .digest('hex');

      // 1st Webhook Delivery: Valid Signature
      const res1 = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', validSignature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      expect(res1.statusCode).toBe(200);
      expect(res1.body.success).toBe(true);

      // Verify Payment doc updated to status 'paid'
      const paidPayment = await Payment.findOne({ gatewayOrderId: orderId });
      expect(paidPayment.status).toBe('paid');
      expect(paidPayment.gatewayPaymentId).toBe(gatewayPaymentId);
      expect(paidPayment.webhookVerifiedAt).toBeDefined();

      // Verify referenced Fines cascade updated to status 'paid' with paidAt timestamp
      const updatedFine1 = await Fine.findById(fine1._id);
      const updatedFine2 = await Fine.findById(fine2._id);

      expect(updatedFine1.status).toBe('paid');
      expect(updatedFine1.paidAt).toBeDefined();
      expect(updatedFine1.paymentId.toString()).toBe(paidPayment._id.toString());

      expect(updatedFine2.status).toBe('paid');
      expect(updatedFine2.paidAt).toBeDefined();
      expect(updatedFine2.paymentId.toString()).toBe(paidPayment._id.toString());

      // 2nd Webhook Delivery: Duplicate Valid Payload (Idempotency Check)
      const res2 = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', validSignature)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      // ACCEPTANCE CRITERIA: Returned 200 OK with alreadyProcessed: true (no-op)
      expect(res2.statusCode).toBe(200);
      expect(res2.body.alreadyProcessed).toBe(true);
      expect(res2.body.message).toContain('Duplicate webhook delivery ignored');
    });
  });
});
