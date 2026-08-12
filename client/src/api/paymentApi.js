import apiClient from "./client";

/**
 * Create a Razorpay Order via backend endpoint
 * @param {Object} payload - { amount (in paise), currency, receipt, fineId }
 */
export const createRazorpayOrder = async ({
  amount,
  currency = "INR",
  receipt,
  fineId,
}) => {
  const { data } = await apiClient.post("/payments/create-order", {
    amount,
    currency,
    receipt,
    fineId,
  });
  return data;
};

/**
 * Verify Razorpay Payment Signature via backend endpoint
 * @param {Object} payload - { razorpay_order_id, razorpay_payment_id, razorpay_signature, fineId }
 */
export const verifyRazorpayPayment = async ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  fineId,
}) => {
  const { data } = await apiClient.post("/payments/verify-payment", {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    fineId,
  });
  return data;
};
