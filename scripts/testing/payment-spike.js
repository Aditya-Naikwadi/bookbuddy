/**
 * Standalone Payment Gateway Spike Script
 * Validates Razorpay API instance instantiation & HMAC signature verification logic.
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');

console.log('⚡ Running Payment Gateway Integration Spike...');

const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkey12345';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret_key_67890';

const rzp = new Razorpay({ key_id, key_secret });

console.log('✅ Razorpay instance created successfully.');

// Test webhook signature verification function shape
const verifyWebhookSignature = (bodyStr, signature, secret) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(bodyStr)
    .digest('hex');
  return expectedSignature === signature;
};

const mockBody = JSON.stringify({ event: 'payment.captured', payload: {} });
const mockSig = crypto.createHmac('sha256', key_secret).update(mockBody).digest('hex');
const isSigValid = verifyWebhookSignature(mockBody, mockSig, key_secret);

console.log(`✅ Webhook signature verification algorithm test: ${isSigValid ? 'PASSED' : 'FAILED'}`);
console.log('🚀 Payment gateway spike completed successfully.');
