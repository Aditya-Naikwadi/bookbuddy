const { z } = require('zod');

const createCollegeSchema = z.object({
  body: z
    .object({
      name: z.string().min(1, 'College name is required'),
      code: z.string().min(1, 'College code is required'),
    })
    .strict(),
});

const createAdminSchema = z.object({
  body: z
    .object({
      studentId: z.string().min(1, 'Admin studentId is required'),
      name: z.string().min(1, 'Admin name is required'),
      email: z.string().email('Invalid email address'),
      password: z.string().min(6, 'Password must be at least 6 characters long'),
      collegeId: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid collegeId MongoDB ObjectId format'),
    })
    .strict(),
});

module.exports = {
  createCollegeSchema,
  createAdminSchema,
};
