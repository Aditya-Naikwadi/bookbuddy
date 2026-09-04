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

const createBookSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').trim(),
    author: z.string().min(1, 'Author is required').trim(),
    isbn: z.string().min(1, 'ISBN is required').trim(),
    category: z.string().min(1, 'Category is required').trim(),
    copiesTotal: z.number().int().min(1, 'Total copies must be at least 1'),
    publishedYear: z.number().int().min(1000).max(new Date().getFullYear()).optional(),
    language: z.string().optional(),
    format: z.enum(['physical', 'digital']).default('physical'),
  }),
});

const updateBookSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Book ID format'),
  }),
  body: z.object({
    title: z.string().min(1).trim().optional(),
    author: z.string().min(1).trim().optional(),
    isbn: z.string().min(1).trim().optional(),
    category: z.string().min(1).trim().optional(),
    copiesTotal: z.number().int().min(1).optional(),
    publishedYear: z.number().int().min(1000).max(new Date().getFullYear()).optional(),
    language: z.string().optional(),
    format: z.enum(['physical', 'digital']).optional(),
  }),
});

const uploadResourceSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').trim(),
    author: z.string().min(1, 'Author is required').trim(),
    type: z.enum(['pdf', 'epub', 'journal']),
    fileUrl: z.string().url('Invalid file URL'),
    category: z.string().min(1, 'Category is required').trim(),
  }),
});

const createStudentSchema = z.object({
  body: z.object({
    studentId: z.string().min(3, 'Student ID must be at least 3 characters').trim(),
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    email: z.string().email('Invalid email address').trim(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
  }),
});

module.exports = {
  placeHoldSchema,
  getQueueSchema,
  renewLoanSchema,
  checkoutSchema,
  returnSchema,
  payFineSchema,
  createBookSchema,
  updateBookSchema,
  uploadResourceSchema,
  createStudentSchema,
};
