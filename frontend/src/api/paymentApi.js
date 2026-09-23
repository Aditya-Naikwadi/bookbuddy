import apiClient from "./client";
import {
  createPaymentOrderBodySchema,
  verifyPaymentBodySchema,
} from "@shared/schemas/payments";

/**
 * Create a Razorpay Order via backend endpoint.
 * Enforces server-side amount calculation only (client-supplied amounts forbidden).
 * @param {Object} payload - { fineId, fineIds, currency }
 */
export const createRazorpayOrder = async (payload = {}) => {
  const { fineId, fineIds, currency = "INR" } = payload;
  const validated = createPaymentOrderBodySchema.parse({
    fineId: fineId || undefined,
    fineIds: fineIds || undefined,
    currency,
  });
  const { data } = await apiClient.post("/payments/create-order", validated);
  return data;
};

/**
 * Verify Razorpay Payment Signature via backend endpoint
 * @param {Object} payload - { razorpay_order_id, razorpay_payment_id, razorpay_signature, fineId, fineIds }
 */
export const verifyRazorpayPayment = async (payload) => {
  const validated = verifyPaymentBodySchema.parse(payload);
  const { data } = await apiClient.post("/payments/verify-payment", validated);
  return data;
};
