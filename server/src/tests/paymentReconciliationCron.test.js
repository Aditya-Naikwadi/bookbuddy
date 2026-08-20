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
    await mongoose.connection.close();
  });

  it('Acceptance Criteria: a manually-simulated mismatch (locally paid but absent on gateway) is FLAGGED in report, not silently ignored', async () => {
    const dummyUserId = new mongoose.Types.ObjectId();

    // 1. Create a Payment document marked 'paid' locally
    const absentPayment = await Payment.create({
      userId: dummyUserId,
      fineIds: [],
      amount: 250.0,
      gatewayOrderId: 'order_absent_gateway_123',
      gatewayPaymentId: 'pay_absent_123',
      status: 'paid', // Marked paid locally
      webhookVerifiedAt: new Date(),
    });

    // 2. Create a Payment document marked 'created' locally, but 'paid' on gateway
    const uncapturedPayment = await Payment.create({
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
