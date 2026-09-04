const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');
const app = require('../app');
const Fine = require('../models/Fine');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');

describe('Razorpay Standard Checkout API Integration Tests', () => {
  let sampleUser;
  let sampleFine;
  let sampleCollege;
  let userToken;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'e7CkAkfrsJzdLz3fTvAwg2MY';

  beforeEach(async () => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const loanId = new mongoose.Types.ObjectId();

    sampleCollege = await College.create({
      name: 'Razorpay Test College',
      code: `RZP_${uniqueSuffix}`,
      status: 'active',
    });

    sampleUser = await User.create({
      name: 'Razorpay Test Student',
      email: `razorpay_student_${uniqueSuffix}@bookbuddy.edu`,
      password: 'Password123!',
      studentId: `STU_${uniqueSuffix}`,
      collegeId: sampleCollege._id,
      role: 'student',
    });

    userToken = generateAccessToken(sampleUser);

    sampleFine = await Fine.create({
      userId: sampleUser._id,
      loanId,
      collegeId: sampleCollege._id,
      overdueDays: 5,
      amount: 50, // ₹50
      reason: 'Late return fine test',
      status: 'unpaid',
    });
  });

  afterEach(async () => {
    if (sampleCollege) {
      await College.deleteOne({ _id: sampleCollege._id });
    }
    if (sampleUser) {
      await User.deleteOne({ _id: sampleUser._id });
    }
    if (sampleFine) {
      await Fine.deleteOne({ _id: sampleFine._id });
    }
  });

  describe('STEP 1: Order Creation (POST /api/create-order & /api/v1/payments/create-order)', () => {
    it('should reject order creation if amount is less than 100 paise (₹1)', async () => {
      const response = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 50 }); // 50 paise

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/100 paise/i);
    });

    it('should successfully create an order for valid amount', async () => {
      const response = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 5000, // ₹50 in paise
          currency: 'INR',
          fineId: sampleFine._id.toString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.order_id).toBeDefined();
      expect(response.body.amount).toBe(5000);
      expect(response.body.currency).toBe('INR');
      expect(response.body.key_id).toBeDefined();
    });

    it('should work via canonical root alias endpoint POST /api/create-order', async () => {
      const response = await request(app)
        .post('/api/v1/create-order')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 1000,
          currency: 'INR',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.order_id).toBeDefined();
    });
  });

  describe('STEP 3: Signature Verification (POST /api/verify-payment & /api/v1/payments/verify-payment)', () => {
    it('should return 400 if required parameters are missing', async () => {
      const response = await request(app)
        .post('/api/v1/payments/verify-payment')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          razorpay_order_id: 'order_test_123',
          // missing razorpay_payment_id and razorpay_signature
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Missing required payment verification/i);
    });

    it('should return 400 and NOT mark fine as paid if signature is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/payments/verify-payment')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          razorpay_order_id: 'order_fake_123',
          razorpay_payment_id: 'pay_fake_456',
          razorpay_signature: 'invalid_mismatched_signature',
          fineId: sampleFine._id.toString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/Invalid payment signature/i);

      // Verify DB record was NOT marked as paid
      const updatedFine = await Fine.findById(sampleFine._id);
      expect(updatedFine.status).toBe('unpaid');
    });

    it('should return 200 and mark fine as paid if HMAC-SHA256 signature matches', async () => {
      const orderId = 'order_valid_789';
      const paymentId = 'pay_valid_987';
      const validSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const response = await request(app)
        .post('/api/v1/payments/verify-payment')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
          fineId: sampleFine._id.toString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/verified successfully/i);

      // Verify DB record WAS updated to paid
      const updatedFine = await Fine.findById(sampleFine._id);
      expect(updatedFine.status).toBe('paid');
      expect(updatedFine.paidAt).toBeDefined();
    });

    it('should work via canonical root alias endpoint POST /api/verify-payment', async () => {
      const orderId = 'order_root_111';
      const paymentId = 'pay_root_222';
      const validSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const response = await request(app)
        .post('/api/v1/verify-payment')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
