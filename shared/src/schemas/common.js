const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = z
  .string()
  .trim()
  .regex(objectIdRegex, 'Invalid MongoDB ObjectId format');

const paramIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

const paramBookIdSchema = z.object({
  params: z.object({
    bookId: objectIdSchema,
  }),
});

const paramEResourceIdSchema = z.object({
  params: z.object({
    eresourceId: objectIdSchema,
  }),
});

const paramLoanIdSchema = z.object({
  params: z.object({
    loanId: objectIdSchema,
  }),
});

const paramGutenbergIdSchema = z.object({
  params: z.object({
    gutenbergId: z.string().regex(/^\d+$/, 'Invalid Gutenberg ID format (must be numeric)'),
  }),
});

const paramRequestIdSchema = z.object({
  params: z.object({
    requestId: objectIdSchema,
  }),
});

const paramIdAndItemIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    itemId: objectIdSchema,
  }),
});

const paramIdAndBookIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    bookId: objectIdSchema,
  }),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

module.exports = {
  objectIdRegex,
  objectIdSchema,
  paramIdSchema,
  paramBookIdSchema,
  paramEResourceIdSchema,
  paramLoanIdSchema,
  paramGutenbergIdSchema,
  paramRequestIdSchema,
  paramIdAndItemIdSchema,
  paramIdAndBookIdSchema,
  paginationQuerySchema,
};
