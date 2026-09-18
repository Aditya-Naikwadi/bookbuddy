// Validation schemas for authentication routes.
const { z } = require('zod');

const registerSchema = z.object({
  body: z
    .object({
      studentId: z.string().trim().optional(),
      name: z.string().min(2, 'Name must be at least 2 characters').trim(),
      email: z.string().email('Invalid email address').trim(),
      password: z.string().min(8, 'Password must be at least 8 characters long'),
      role: z
        .enum(['student', 'college-student', 'general'], {
          errorMap: () => ({
            message:
              'Direct registration for administrative roles is not permitted. Please use the institutional tenant onboarding flow.',
          }),
        })
        .default('student'),
      collegeId: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid College ID format')
        .optional()
        .nullable(),
    })
    .refine(
      (data) => {
        if (data.role === 'college-student' || (data.role === 'student' && data.studentId)) {
          return Boolean(
            data.collegeId && typeof data.collegeId === 'string' && data.collegeId.trim()
          );
        }
        return true;
      },
      {
        message: 'College selection is required. Please select your institution.',
        path: ['collegeId'],
      }
    ),
});

const loginSchema = z.object({
  body: z
    .object({
      email: z.string().trim().optional(),
      studentId: z.string().trim().optional(),
      password: z.string().min(1, 'Password is required'),
      totpCode: z.string().optional(),
      collegeSlug: z.string().trim().optional(),
      collegeId: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid College ID format')
        .optional(),
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
