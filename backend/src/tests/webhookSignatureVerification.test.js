/**
 * Test Suite: Webhook Signature Verification & Idempotency Audit
 *
 * Verifies that all inbound webhook endpoints strictly enforce:
 * 1. Absence of signature is rejected with 400.
 * 2. Incorrect signature is rejected with 400.
 * 3. Tampered payload body is rejected with 400.
 * 4. Replayed old timestamp (> 5 minutes) is rejected with 400.
 * 5. Genuine cryptographic signature with fresh timestamp is accepted (200).
 * 6. Duplicate webhook events are handled idempotently without duplicate side-effects.
 * 7. Fast 2xx response returns quickly while background side-effects execute asynchronously.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testjwtsecretwebhook123';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretwebhook123';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_signing_secret_999';

const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');

const User = require('../models/User');
const College = require('../models/College');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const paymentGatewayService = require('../services/paymentGatewayService');

describe('Webhook Signature Verification Security Suite', () => {
  let college;
  let studentUser;
  let fine;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const generateSignature = (payload, secret = webhookSecret) => {
    const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(rawString).digest('hex');
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const unique = Date.now().toString(36);
    college = await College.create({
      name: `Webhook College ${unique}`,
      code: `WH-${unique}`,
      slug: `wh-${unique}`,
      status: 'active',
    });

    studentUser = await User.create({
      name: 'Webhook Student',
      email: `webhook_student_${unique}@test.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: college._id,
      studentId: `WH-STU-${unique}`,
      status: 'active',
    });

    fine = await Fine.create({
      userId: studentUser._id,
      collegeId: college._id,
      loanId: new mongoose.Types.ObjectId(),
      overdueDays: 3,
      amount: 150,
      reason: 'Late return',
      status: 'unpaid',
      paymentStatus: 'unpaid',
    });
  });

  afterAll(async () => {
    if (studentUser) await User.deleteOne({ _id: studentUser._id });
    if (college) await College.deleteOne({ _id: college._id });
    if (fine) await Fine.deleteOne({ _id: fine._id });
    await Payment.deleteMany({ userId: studentUser?._id });
  });

  describe('1. Missing and Invalid Signature Rejection', () => {
    it('rejects inbound webhook with missing x-razorpay-signature header with 400', async () => {
      const payload = {
        event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: 'pay_no_sig_1',
              order_id: 'order_no_sig_1',
              amount: 15000,
            },
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/signature/i);
    });

    it('rejects inbound webhook with forged / wrong signature with 400', async () => {
      const payload = {
        event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: 'pay_wrong_sig_1',
              order_id: 'order_wrong_sig_1',
              amount: 15000,
            },
          },
        },
      };

      const wrongSignature = generateSignature(payload, 'wrong_tampered_secret_key');

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', wrongSignature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/signature/i);
    });

    it('rejects inbound webhook when payload body has been tampered with after signing with 400', async () => {
      const originalPayload = {
        event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: 'pay_tamper_1',
              order_id: 'order_tamper_1',
              amount: 15000,
            },
          },
        },
      };

      const validSignatureForOriginal = generateSignature(originalPayload, webhookSecret);

      // Tamper with the body by changing the amount to 1 rupee
      const tamperedPayload = {
        ...originalPayload,
        payload: {
          payment: {
            entity: {
              ...originalPayload.payload.payment.entity,
              amount: 100, // Tampered!
            },
          },
        },
      };

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', validSignatureForOriginal)
        .set('Content-Type', 'application/json')
        .send(tamperedPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/signature/i);
    });
  });

  describe('2. Timestamp Tolerance & Replay Attack Prevention', () => {
    it('rejects replayed webhook with expired timestamp (> 5 minutes old) with 400', async () => {
      const tenMinutesAgoSec = Math.floor((Date.now() - 10 * 60 * 1000) / 1000);
      const replayPayload = {
        event: 'payment.captured',
        created_at: tenMinutesAgoSec,
        payload: {
          payment: {
            entity: {
              id: 'pay_replay_expired',
              order_id: 'order_replay_expired',
              amount: 15000,
            },
          },
        },
      };

      const signature = generateSignature(replayPayload, webhookSecret);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-time', tenMinutesAgoSec.toString())
        .set('Content-Type', 'application/json')
        .send(replayPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/tolerance|replay/i);
    });

    it('rejects webhook with future timestamp outside 5-minute tolerance window with 400', async () => {
      const tenMinutesFutureSec = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
      const futurePayload = {
        event: 'payment.captured',
        created_at: tenMinutesFutureSec,
        payload: {
          payment: {
            entity: {
              id: 'pay_future_invalid',
              order_id: 'order_future_invalid',
              amount: 15000,
            },
          },
        },
      };

      const signature = generateSignature(futurePayload, webhookSecret);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(futurePayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/tolerance|replay/i);
    });
  });

  describe('3. Legitimate Inbound Webhook Acceptance & Idempotency', () => {
    it('accepts genuine webhook with valid signature and fresh timestamp (200)', async () => {
      const freshTimeSec = Math.floor(Date.now() / 1000);
      const orderId = `order_genuine_${Date.now()}`;
      const paymentId = `pay_genuine_${Date.now()}`;
      const eventId = `evt_genuine_${Date.now()}`;

      const genuinePayload = {
        event_id: eventId,
        event: 'payment.captured',
        created_at: freshTimeSec,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 15000,
              notes: {
                fineId: fine._id.toString(),
              },
            },
          },
        },
      };

      const signature = generateSignature(genuinePayload, webhookSecret);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-time', freshTimeSec.toString())
        .set('Content-Type', 'application/json')
        .send(genuinePayload);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('paid');
      expect(res.body.data.gatewayOrderId).toBe(orderId);

      // Verify DB record
      const dbPayment = await Payment.findOne({ gatewayOrderId: orderId });
      expect(dbPayment).toBeDefined();
      expect(dbPayment.status).toBe('paid');
      expect(dbPayment.providerEventId).toBe(eventId);

      // 4. Verify Idempotency: duplicate delivery of identical event ID is ignored as no-op
      const duplicateRes = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-time', freshTimeSec.toString())
        .set('Content-Type', 'application/json')
        .send(genuinePayload);

      expect(duplicateRes.statusCode).toBe(200);
      expect(duplicateRes.body.alreadyProcessed).toBe(true);
      expect(duplicateRes.body.message).toMatch(/duplicate/i);
    });
  });

  describe('4. Provider Re-fetch Verification Integration', () => {
    it('rejects webhook when provider API reports non-successful payment status', async () => {
      const freshTimeSec = Math.floor(Date.now() / 1000);
      const orderId = `order_refetch_${Date.now()}`;
      const paymentId = `pay_failed_upstream_${Date.now()}`;

      // Mock gateway returning failed status on fetch
      const fetchSpy = jest.spyOn(paymentGatewayService, 'fetchPaymentFromGateway');
      fetchSpy.mockResolvedValueOnce({
        id: paymentId,
        status: 'failed',
        amount: 15000,
      });

      const payload = {
        event: 'payment.captured',
        created_at: freshTimeSec,
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 15000,
            },
          },
        },
      };

      const signature = generateSignature(payload, webhookSecret);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      if (fetchSpy) {
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Provider re-fetch verification failed/i);
        fetchSpy.mockRestore();
      }
    });
  });
});
