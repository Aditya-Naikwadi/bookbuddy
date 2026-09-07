const { z } = require('zod');

const createCollegeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'College name is required'),
    code: z.string().min(1, 'College code is required'),
    shortName: z.string().optional(),
    domain: z.string().optional(),
    slug: z.string().optional(),
    adminName: z.string().optional(),
    adminEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
    password: z.string().optional(),
    selectedServices: z.array(z.string()).optional(),
  }),
});

const createAdminSchema = z.object({
  body: z
    .object({
      studentId: z.string().min(1, 'Admin studentId is required'),
      name: z.string().min(1, 'Admin name is required'),
      email: z.string().email('Invalid email address'),
      password: z.string().min(6, 'Password must be at least 6 characters long'),
      collegeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid collegeId MongoDB ObjectId format'),
    })
    .strict(),
});

const updateUserStatusSchema = z.object({
  body: z.object({
    status: z
      .enum(['active', 'disabled', 'invited', 'pending', 'inactive'], {
        errorMap: () => ({ message: 'Invalid user status value.' }),
      })
      .optional(),
    membershipStatus: z
      .enum(['active', 'suspended', 'expired'], {
        errorMap: () => ({ message: 'Invalid membership status value.' }),
      })
      .optional(),
    isActive: z.boolean().optional(),
  }),
});

const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.enum(['student', 'college-admin', 'super-admin', 'general', 'librarian', 'admin']),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters long').optional(),
  }),
});

const updateSystemSettingsSchema = z.object({
  body: z.record(z.any()),
});

module.exports = {
  createCollegeSchema,
  createAdminSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  resetPasswordSchema,
  updateSystemSettingsSchema,
};
