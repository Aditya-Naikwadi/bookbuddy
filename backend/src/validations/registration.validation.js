const { z } = require('zod');

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const passwordMessage =
  'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)';

const studentRegisterSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, 'Full name must be at least 2 characters').trim(),
      email: z.string().email('Invalid email address').trim().toLowerCase(),
      password: z.string().regex(passwordRegex, passwordMessage),
      confirmPassword: z.string(),
      collegeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Please select a valid active college'),
      studentId: z.string().min(2, 'Student / Enrollment ID is required').trim(),
      department: z.string().optional(),
      phone: z.string().optional(),
      termsAccepted: z
        .boolean()
        .refine((val) => val === true, 'You must accept the Terms and Privacy Policy'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').trim().toLowerCase(),
    otp: z.string().min(4, 'OTP is required').trim(),
  }),
});

const tenantOnboardingSchema = z.object({
  body: z
    .object({
      collegeName: z.string().min(2, 'College Name is required').optional(),
      legalName: z.string().optional(),
      collegeEmail: z.string().optional(),
      domain: z.string().optional(),
      adminName: z.string().min(2, 'Admin Full Name is required').trim(),
      adminEmail: z.string().email('Invalid Admin Email address').trim().toLowerCase(),
      password: z.string().min(6, 'Password must be at least 6 characters long'),
      confirmPassword: z.string(),
      shortName: z.string().optional(),
      institutionType: z.string().optional(),
      address: z.any().optional(),
      contactPhone: z.string().optional(),
      designation: z.string().optional(),
      adminPhone: z.string().optional(),
      desiredSlug: z.string().optional(),
      termsAccepted: z.any().optional(),
      selectedServices: z.any().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    })
    .refine((data) => Boolean(data.collegeName || data.legalName), {
      message: 'College / Institution Name is required',
      path: ['collegeName'],
    }),
});

const rejectOnboardingSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(5, 'A valid rejection reason of at least 5 characters is required')
      .trim(),
  }),
});

module.exports = {
  studentRegisterSchema,
  verifyEmailSchema,
  tenantOnboardingSchema,
  rejectOnboardingSchema,
};
