import { z  } from 'zod';
import { objectIdSchema  } from './common.js';

const placeHoldBodySchema = z.object({
  bookId: objectIdSchema,
});

const placeHoldRouteSchema = z.object({
  body: placeHoldBodySchema,
});

const getQueueQuerySchema = z.object({
  bookId: objectIdSchema,
});

const getQueueRouteSchema = z.object({
  query: getQueueQuerySchema,
});

const renewLoanRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

const checkoutBodySchema = z.object({
  userId: objectIdSchema,
  bookId: objectIdSchema,
});

const checkoutRouteSchema = z.object({
  body: checkoutBodySchema,
});

const returnBodySchema = z.object({
  loanId: objectIdSchema,
});

const returnRouteSchema = z.object({
  body: returnBodySchema,
});

const payFineRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

const createBookBodySchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  author: z.string().min(1, 'Author is required').trim(),
  isbn: z.string().min(1, 'ISBN is required').trim(),
  category: z.string().min(1, 'Category is required').trim(),
  copiesTotal: z.number().int().min(1, 'Total copies must be at least 1'),
  publishedYear: z.number().int().min(1000).max(new Date().getFullYear()).optional(),
  language: z.string().optional(),
  format: z.enum(['physical', 'digital']).default('physical'),
});

const createBookRouteSchema = z.object({
  body: createBookBodySchema,
});

const updateBookBodySchema = z.object({
  title: z.string().min(1).trim().optional(),
  author: z.string().min(1).trim().optional(),
  isbn: z.string().min(1).trim().optional(),
  category: z.string().min(1).trim().optional(),
  copiesTotal: z.number().int().min(1).optional(),
  publishedYear: z.number().int().min(1000).max(new Date().getFullYear()).optional(),
  language: z.string().optional(),
  format: z.enum(['physical', 'digital']).optional(),
});

const updateBookRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: updateBookBodySchema,
});

const uploadResourceBodySchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  author: z.string().min(1, 'Author is required').trim(),
  type: z.enum(['pdf', 'epub', 'journal']),
  fileUrl: z.string().url('Invalid file URL'),
  category: z.string().min(1, 'Category is required').trim(),
});

const uploadResourceRouteSchema = z.object({
  body: uploadResourceBodySchema,
});

const createStudentBodySchema = z.object({
  studentId: z.string().min(3, 'Student ID must be at least 3 characters').trim(),
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Invalid email address').trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

const createStudentRouteSchema = z.object({
  body: createStudentBodySchema,
});

export {
  placeHoldBodySchema,
  placeHoldRouteSchema,
  placeHoldRouteSchema as placeHoldSchema,
  getQueueQuerySchema,
  getQueueRouteSchema,
  getQueueRouteSchema as getQueueSchema,
  renewLoanRouteSchema,
  renewLoanRouteSchema as renewLoanSchema,
  checkoutBodySchema,
  checkoutRouteSchema,
  checkoutRouteSchema as checkoutSchema,
  returnBodySchema,
  returnRouteSchema,
  returnRouteSchema as returnSchema,
  payFineRouteSchema,
  payFineRouteSchema as payFineSchema,
  createBookBodySchema,
  createBookRouteSchema,
  createBookRouteSchema as createBookSchema,
  updateBookBodySchema,
  updateBookRouteSchema,
  updateBookRouteSchema as updateBookSchema,
  uploadResourceBodySchema,
  uploadResourceRouteSchema,
  uploadResourceRouteSchema as uploadResourceSchema,
  createStudentBodySchema,
  createStudentRouteSchema,
  createStudentRouteSchema as createStudentSchema,
};
export default {
  placeHoldBodySchema,
  placeHoldRouteSchema,
  placeHoldSchema: placeHoldRouteSchema,
  getQueueQuerySchema,
  getQueueRouteSchema,
  getQueueSchema: getQueueRouteSchema,
  renewLoanRouteSchema,
  renewLoanSchema: renewLoanRouteSchema,
  checkoutBodySchema,
  checkoutRouteSchema,
  checkoutSchema: checkoutRouteSchema,
  returnBodySchema,
  returnRouteSchema,
  returnSchema: returnRouteSchema,
  payFineRouteSchema,
  payFineSchema: payFineRouteSchema,
  createBookBodySchema,
  createBookRouteSchema,
  createBookSchema: createBookRouteSchema,
  updateBookBodySchema,
  updateBookRouteSchema,
  updateBookSchema: updateBookRouteSchema,
  uploadResourceBodySchema,
  uploadResourceRouteSchema,
  uploadResourceSchema: uploadResourceRouteSchema,
  createStudentBodySchema,
  createStudentRouteSchema,
  createStudentSchema: createStudentRouteSchema,
};
