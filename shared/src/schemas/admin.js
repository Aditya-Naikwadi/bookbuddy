const { z } = require('zod');
const { objectIdSchema } = require('./common');

const createCollegeBodySchema = z.object({
  name: z.string().min(1, 'College name is required'),
  code: z.string().min(1, 'College code is required'),
  shortName: z.string().optional(),
  domain: z.string().optional(),
  slug: z.string().optional(),
  adminName: z.string().optional(),
  adminEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().optional(),
  selectedServices: z.array(z.string()).optional(),
});

const createCollegeRouteSchema = z.object({
  body: createCollegeBodySchema,
});

const createAdminBodySchema = z
  .object({
    studentId: z.string().min(1, 'Admin studentId is required'),
    name: z.string().min(1, 'Admin name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    collegeId: objectIdSchema,
  })
  .strict();

const createAdminRouteSchema = z.object({
  body: createAdminBodySchema,
});

const updateUserStatusBodySchema = z.object({
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
});

const updateUserStatusRouteSchema = z.object({
  body: updateUserStatusBodySchema,
});

const updateUserRoleBodySchema = z.object({
  role: z.enum(['student', 'college-admin', 'super-admin', 'general', 'librarian', 'admin']),
});

const updateUserRoleRouteSchema = z.object({
  body: updateUserRoleBodySchema,
});

const resetPasswordBodySchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters long').optional(),
});

const resetPasswordRouteSchema = z.object({
  body: resetPasswordBodySchema,
});

const updateSystemSettingsBodySchema = z.record(z.any());

const updateSystemSettingsRouteSchema = z.object({
  body: updateSystemSettingsBodySchema,
});

module.exports = {
  createCollegeBodySchema,
  createCollegeRouteSchema,
  createCollegeSchema: createCollegeRouteSchema,
  createAdminBodySchema,
  createAdminRouteSchema,
  createAdminSchema: createAdminRouteSchema,
  updateUserStatusBodySchema,
  updateUserStatusRouteSchema,
  updateUserStatusSchema: updateUserStatusRouteSchema,
  updateUserRoleBodySchema,
  updateUserRoleRouteSchema,
  updateUserRoleSchema: updateUserRoleRouteSchema,
  resetPasswordBodySchema,
  resetPasswordRouteSchema,
  resetPasswordSchema: resetPasswordRouteSchema,
  updateSystemSettingsBodySchema,
  updateSystemSettingsRouteSchema,
  updateSystemSettingsSchema: updateSystemSettingsRouteSchema,
};
