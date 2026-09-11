/**
 * Consolidated Suite: payments
 * Merged from:
 *  - paymentRazorpayIntegration.test.js
 *  - razorpayPaymentIntegrations.test.js
 *  - paymentIdempotency.test.js
 *  - paymentWebhook.test.js
 *  - paymentReconciliationCron.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('payments Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: paymentRazorpayIntegration.test.js]', () => {
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
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'e7CkAkfrsJzdLz3fTvAwg2MY')
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
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'e7CkAkfrsJzdLz3fTvAwg2MY')
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
  });

  describe('[Source: razorpayPaymentIntegrations.test.js]', () => {
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
        // await // mongoose.connection.close();
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
  });

  describe('[Source: paymentIdempotency.test.js]', () => {
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_payment_idempotency_test';

    const Payment = require('../models/Payment');
    const Fine = require('../models/Fine');
    const User = require('../models/User');

    describe('Payment Model Idempotency Index & Fine Schema Extension', () => {
      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await Payment.deleteMany({});
        await Fine.deleteMany({});
        await User.deleteMany({});
        await Payment.syncIndexes();
      });

      afterAll(async () => {
        await Payment.deleteMany({});
        await Fine.deleteMany({});
        await User.deleteMany({});
        // await // mongoose.connection.close();
      });

      it('Acceptance Criteria: two webhook deliveries carrying the same gatewayOrderId cannot create separate Payment documents', async () => {
        const dummyUserId = new mongoose.Types.ObjectId();
        const dummyFineId1 = new mongoose.Types.ObjectId();
        const dummyFineId2 = new mongoose.Types.ObjectId();
        const orderId = `order_gw_${Date.now()}`;

        // 1st Webhook delivery / Payment creation
        const payment1 = await Payment.create({
          userId: dummyUserId,
          fineIds: [dummyFineId1, dummyFineId2],
          amount: 150.5,
          gatewayOrderId: orderId,
          gatewayPaymentId: `pay_${Date.now()}`,
          status: 'paid',
          webhookVerifiedAt: new Date(),
        });

        expect(payment1._id).toBeDefined();
        expect(payment1.gatewayOrderId).toBe(orderId);

        // 2nd Webhook delivery carrying the duplicate gatewayOrderId MUST fail with code 11000 (Duplicate Key)
        let duplicateError = null;
        try {
          await Payment.create({
            userId: dummyUserId,
            fineIds: [dummyFineId1, dummyFineId2],
            amount: 150.5,
            gatewayOrderId: orderId, // Duplicate orderId
            gatewayPaymentId: `pay_${Date.now()}_dup`,
            status: 'paid',
            webhookVerifiedAt: new Date(),
          });
        } catch (err) {
          duplicateError = err;
        }

        expect(duplicateError).not.toBeNull();
        // Unique index Mongo error code 11000 or duplicate key message
        expect(
          duplicateError.code === 11000 || duplicateError.message.includes('duplicate key')
        ).toBe(true);

        // Ensure total Payment count in DB remains exactly 1
        const count = await Payment.countDocuments({ gatewayOrderId: orderId });
        expect(count).toBe(1);
      });

      it('verifies Fine schema extension with paidAt and paymentId fields', async () => {
        const dummyCollegeId = new mongoose.Types.ObjectId();
        const dummyUserId = new mongoose.Types.ObjectId();
        const dummyLoanId = new mongoose.Types.ObjectId();

        const payment = await Payment.create({
          userId: dummyUserId,
          fineIds: [],
          amount: 50.0,
          gatewayOrderId: `order_fine_ext_${Date.now()}`,
          status: 'created',
        });

        const paidDate = new Date();
        const fine = await Fine.create({
          collegeId: dummyCollegeId,
          userId: dummyUserId,
          loanId: dummyLoanId,
          overdueDays: 5,
          amount: 50.0,
          status: 'paid',
          paidAt: paidDate,
          paymentId: payment._id,
        });

        expect(fine.paidAt).toEqual(paidDate);
        expect(fine.paymentId.toString()).toBe(payment._id.toString());
      });
    });
  });

  describe('[Source: paymentWebhook.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const crypto = require('crypto');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_key_123';
    jest.setTimeout(60000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Loan = require('../models/Loan');
    const Fine = require('../models/Fine');
    const Payment = require('../models/Payment');

    describe('Payment Processing & Webhook Signature Idempotency Unit Tests', () => {
      let college;
      let studentUser;
      let book;
      let loan;
      let fine;
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
      });

      afterAll(async () => {
        await College.deleteMany({ code: 'PAY_TEST_UNI' });
        await User.deleteMany({ email: 'paytest_isolated@bookbuddy.com' });
        await Book.deleteMany({ title: 'Payment Test Book' });
        // await // mongoose.connection.close();
      });

      beforeEach(async () => {
        await College.deleteMany({ code: 'PAY_TEST_UNI' });
        await User.deleteMany({ email: 'paytest_isolated@bookbuddy.com' });
        await Book.deleteMany({ title: 'Payment Test Book' });
        await Loan.deleteMany({});
        await Fine.deleteMany({});
        await Payment.deleteMany({});

        college = await College.create({
          name: 'Payment Test University',
          code: 'PAY_TEST_UNI_' + Math.floor(Math.random() * 10000),
        });

        studentUser = await User.create({
          studentId: 'STU_PAY_' + Math.floor(Math.random() * 10000),
          name: 'Payment Student',
          email: `paytest_${Math.floor(Math.random() * 10000)}@bookbuddy.com`,
          password: 'hashedpassword123',
          role: 'student',
          collegeId: college._id,
        });

        book = await Book.create({
          collegeId: college._id,
          title: 'Payment Test Book',
          author: 'Hector Garcia-Molina',
          category: 'Computer Science',
          isbn: `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          totalCopies: 5,
          availableCopies: 4,
        });

        loan = await Loan.create({
          collegeId: college._id,
          userId: studentUser._id,
          bookId: book._id,
          issuedBy: studentUser._id,
          maxRenewals: 2,
          issuedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          status: 'active',
        });

        fine = await Fine.create({
          userId: studentUser._id,
          collegeId: college._id,
          loanId: loan._id,
          overdueDays: 5,
          amount: 150,
          status: 'unpaid',
        });
      });

      test('1. Reject Forged/Unsigned Webhook: Missing or invalid signature returns 400 and leaves fine unpaid', async () => {
        const payload = {
          event_id: 'evt_forged_' + Math.random(),
          payload: {
            payment: {
              entity: {
                id: 'pay_forged_' + Math.random(),
                amount: 15000,
                notes: { fineId: fine._id.toString() },
              },
            },
          },
        };

        const res = await request(app)
          .post('/api/v1/payments/webhook')
          .set('x-razorpay-signature', 'invalid_forged_signature_hash')
          .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Signature verification failed');

        // Verify fine status in DB remains unpaid
        const checkFine = await Fine.findById(fine._id);
        expect(checkFine.status).toBe('unpaid');
        expect(checkFine.paidAt).toBeNull();
      });

      test('2. Valid Signature Success: Verified signature updates fine to paid and creates payment record', async () => {
        const payload = {
          event_id: 'evt_valid_' + Math.random(),
          payload: {
            payment: {
              entity: {
                id: 'pay_valid_' + Math.random(),
                amount: 15000,
                notes: { fineId: fine._id.toString() },
              },
            },
          },
        };

        const payloadStr = JSON.stringify(payload);
        const validSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(payloadStr)
          .digest('hex');

        const res = await request(app)
          .post('/api/v1/payments/webhook')
          .set('x-razorpay-signature', validSignature)
          .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify Fine in DB was updated to paid
        const updatedFine = await Fine.findById(fine._id);
        expect(updatedFine.status).toBe('paid');
        expect(updatedFine.paidAt).toBeDefined();

        // Verify Payment record was created
        const paymentRecord = await Payment.findOne({ providerEventId: payload.event_id });
        expect(paymentRecord).not.toBeNull();
        expect(paymentRecord.fineId.toString()).toBe(fine._id.toString());
        expect(paymentRecord.amount).toBe(150);
      });

      test('3. Idempotency Prevention: Duplicate webhook delivery is ignored and does not double-mark paid', async () => {
        const eventId = 'evt_duplicate_' + Math.floor(Math.random() * 1000000);
        const payId = 'pay_duplicate_' + Math.floor(Math.random() * 1000000);
        const payload = {
          event_id: eventId,
          payload: {
            payment: {
              entity: {
                id: payId,
                amount: 15000,
                notes: { fineId: fine._id.toString() },
              },
            },
          },
        };

        const payloadStr = JSON.stringify(payload);
        const validSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(payloadStr)
          .digest('hex');

        // First Delivery
        const res1 = await request(app)
          .post('/api/v1/payments/webhook')
          .set('x-razorpay-signature', validSignature)
          .send(payload);

        expect(res1.status).toBe(200);
        expect(res1.body.success).toBe(true);

        const firstFineState = await Fine.findById(fine._id);
        const firstPaidAtTime = firstFineState.paidAt.getTime();

        // Second Duplicate Delivery
        const res2 = await request(app)
          .post('/api/v1/payments/webhook')
          .set('x-razorpay-signature', validSignature)
          .send(payload);

        expect(res2.status).toBe(200);
        expect(res2.body.alreadyProcessed).toBe(true);

        // Verify fine paidAt timestamp was NOT modified and duplicate payment record was not created
        const secondFineState = await Fine.findById(fine._id);
        expect(secondFineState.paidAt.getTime()).toBe(firstPaidAtTime);

        const paymentCount = await Payment.countDocuments({ providerEventId: eventId });
        expect(paymentCount).toBe(1);
      });
    });
  });

  describe('[Source: paymentReconciliationCron.test.js]', () => {
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_payment_recon_test';

    const Payment = require('../models/Payment');
    const { runDailyPaymentReconciliation } = require('../services/cronService');
    const paymentGatewayService = require('../services/paymentGatewayService');

    describe('F7.6 — Daily Payment Reconciliation Cron Job Mismatch Audit', () => {
      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await Payment.deleteMany({});
      });

      afterAll(async () => {
        await Payment.deleteMany({});
        // await // mongoose.connection.close();
      });

      it('Acceptance Criteria: a manually-simulated mismatch (locally paid but absent on gateway) is FLAGGED in report, not silently ignored', async () => {
        const dummyUserId = new mongoose.Types.ObjectId();

        // 1. Create a Payment document marked 'paid' locally
        await Payment.create({
          userId: dummyUserId,
          fineIds: [],
          amount: 250.0,
          gatewayOrderId: 'order_absent_gateway_123',
          gatewayPaymentId: 'pay_absent_123',
          status: 'paid', // Marked paid locally
          webhookVerifiedAt: new Date(),
        });

        // 2. Create a Payment document marked 'created' locally, but 'paid' on gateway
        await Payment.create({
          userId: dummyUserId,
          fineIds: [],
          amount: 100.0,
          gatewayOrderId: 'order_uncaptured_gateway_456',
          status: 'created', // Still created locally
        });

        // 3. Mock paymentGatewayService.fetchOrderFromGateway
        const vi_spy = jest
          .spyOn(paymentGatewayService, 'fetchOrderFromGateway')
          .mockImplementation((orderId) => {
            if (orderId === 'order_absent_gateway_123') {
              // Absent on payment gateway API (returns null)
              return Promise.resolve(null);
            }
            if (orderId === 'order_uncaptured_gateway_456') {
              // Gateway status is 'paid' while local DB is 'created'
              return Promise.resolve({
                id: 'order_uncaptured_gateway_456',
                status: 'paid',
                amount: 10000,
              });
            }
            return Promise.resolve(null);
          });

        // Execute daily reconciliation job
        const report = await runDailyPaymentReconciliation({
          since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });

        vi_spy.mockRestore();

        // ACCEPTANCE CRITERIA: Report must NOT silently ignore the mismatches!
        expect(report).toBeDefined();
        expect(report.processedCount).toBeGreaterThanOrEqual(2);
        expect(report.mismatchCount).toBe(2);

        const absentMismatch = report.mismatches.find(
          (m) => m.gatewayOrderId === 'order_absent_gateway_123'
        );
        expect(absentMismatch).toBeDefined();
        expect(absentMismatch.localStatus).toBe('paid');
        expect(absentMismatch.gatewayStatus).toBe('ABSENT');
        expect(absentMismatch.issue).toContain('absent on payment gateway API');

        const uncapturedMismatch = report.mismatches.find(
          (m) => m.gatewayOrderId === 'order_uncaptured_gateway_456'
        );
        expect(uncapturedMismatch).toBeDefined();
        expect(uncapturedMismatch.localStatus).toBe('created');
        expect(uncapturedMismatch.gatewayStatus).toBe('paid');
      });
    });
  });
});
