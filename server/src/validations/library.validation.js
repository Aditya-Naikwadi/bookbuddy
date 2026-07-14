// Zod input validation schemas for library operational endpoints.
const { z } = require('zod');

const placeHoldSchema = z.object({
  body: z.object({
    bookId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Book ID format'),
  }),
});

const getQueueSchema = z.object({
  query: z.object({
    bookId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Book ID format'),
  }),
});

const renewLoanSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Loan ID format'),
  }),
});

const checkoutSchema = z.object({
  body: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid User ID format'),
    bookId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Book ID format'),
  }),
});

const returnSchema = z.object({
  body: z.object({
    loanId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Loan ID format'),
  }),
});

const payFineSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Fine ID format'),
  }),
});

module.exports = {
  placeHoldSchema,
  getQueueSchema,
  renewLoanSchema,
  checkoutSchema,
  returnSchema,
  payFineSchema,
};
