const Razorpay = require('razorpay');
const crypto = require('crypto');

/**
 * Get initialized Razorpay SDK instance using environment credentials.
 */
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key_id';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_razorpay_secret_key';

  return new Razorpay({
    key_id,
    key_secret,
  });
};

/**
 * Create a new payment order with the gateway.
 * Converts amount from INR to paise (Razorpay API requires amount in paise: 1 INR = 100 paise).
 */
const createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  const razorpay = getRazorpayInstance();
  const amountInPaise = Math.round(amount * 100);

  const options = {
    amount: amountInPaise,
    currency,
    receipt: receipt || `receipt_${Date.now()}`,
    notes,
  };

  const order = await razorpay.orders.create(options);
  return order;
};

/**
 * Verifies the authenticity of a Razorpay webhook payload signature.
 * @param {string|Buffer} rawBody - Raw HTTP body payload
 * @param {string} signature - Value of x-razorpay-signature header
 * @param {string} [webhookSecret] - Webhook secret key
 * @returns {boolean} true if signature is valid
 */
const verifyWebhookSignature = (rawBody, signature, webhookSecret) => {
  const secret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
  if (!signature || !rawBody) return false;

  try {
    const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const expectedSignature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  /* eslint-disable-next-line no-unused-vars */
  } catch (err) {
    return false;
  }
};

/**
 * Fetches order details from the gateway via API.
 * @param {string} gatewayOrderId
 * @returns {Promise<Object|null>}
 */
const fetchOrderFromGateway = async (gatewayOrderId) => {
  const razorpay = getRazorpayInstance();
  try {
    const order = await razorpay.orders.fetch(gatewayOrderId);
    return order;
  /* eslint-disable-next-line no-unused-vars */
  } catch (err) {
    return null;
  }
};

module.exports = {
  getRazorpayInstance,
  createOrder,
  verifyWebhookSignature,
  fetchOrderFromGateway,
};
