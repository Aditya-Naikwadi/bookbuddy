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
    await mongoose.connection.close();
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
    expect(duplicateError.code === 11000 || duplicateError.message.includes('duplicate key')).toBe(
      true
    );

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
