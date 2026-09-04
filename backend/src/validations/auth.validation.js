// Validation schemas for authentication routes.
const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    studentId: z.string().min(3, 'Student ID must be at least 3 characters').trim(),
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    email: z.string().email('Invalid email address').trim(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    role: z
      .enum(['student', 'college-admin', 'college_admin', 'super-admin', 'super_admin', 'general'])
      .default('student'),
    collegeId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid College ID format')
      .optional(),
  }),
});

const loginSchema = z.object({
  body: z
    .object({
      email: z.string().trim().optional(),
      studentId: z.string().trim().optional(),
      password: z.string().min(1, 'Password is required'),
      totpCode: z.string().optional(),
    })
    .refine((data) => data.email || data.studentId, {
      message: 'Either email or studentId must be provided',
      path: ['email'],
    }),
});

const refreshSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
