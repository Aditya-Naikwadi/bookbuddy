const { z } = require('zod');
const { objectIdSchema } = require('./common');

/**
 * Payment Order Creation Schema (AppSec Hardened)
 *
 * CRITICAL TRUST BOUNDARY RULE:
 * Clients are strictly forbidden from passing `amount`, `clientAmount`, or `receipt`.
 * The payment order amount MUST be computed authoritatively by the server
 * from the database records of unpaid fines.
 *
 * `.strict()` ensures any attempt to pass `amount` triggers an immediate 400 rejection.
 */
const createPaymentOrderBodySchema = z
  .object({
    fineId: objectIdSchema.optional(),
    fineIds: z.array(objectIdSchema).optional(),
    currency: z.enum(['INR']).default('INR').optional(),
  })
  .strict({
    message:
      'Client-supplied payment amounts or custom receipt parameters are forbidden. Amounts are computed server-side.',
  });

const createPaymentOrderRouteSchema = z.object({
  body: createPaymentOrderBodySchema,
});

/**
 * Razorpay Payment Verification Schema
 */
const verifyPaymentBodySchema = z
  .object({
    razorpay_order_id: z.string().trim().min(1, 'razorpay_order_id is required'),
    razorpay_payment_id: z.string().trim().min(1, 'razorpay_payment_id is required'),
    razorpay_signature: z.string().trim().min(1, 'razorpay_signature is required'),
    fineId: objectIdSchema.optional(),
    fineIds: z.array(objectIdSchema).optional(),
  })
  .strict();

const verifyPaymentRouteSchema = z.object({
  body: verifyPaymentBodySchema,
});

module.exports = {
  createPaymentOrderBodySchema,
  createPaymentOrderRouteSchema,
  verifyPaymentBodySchema,
  verifyPaymentRouteSchema,
};
