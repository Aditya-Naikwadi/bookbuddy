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
      collegeId: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Please select a valid active college'),
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
      legalName: z.string().min(3, 'Legal institution name must be at least 3 characters').trim(),
      shortName: z.string().optional(),
      institutionType: z.enum(['university', 'college', 'school', 'training_institute'], {
        errorMap: () => ({ message: 'Please select a valid institution type' }),
      }),
      domain: z
        .string()
        .min(3, 'Official website domain is required (e.g., college.edu)')
        .trim()
        .toLowerCase(),
      address: z.union([
        z.string().min(5, 'Address is required'),
        z.object({
          street: z.string().optional(),
          city: z.string().min(2, 'City is required'),
          state: z.string().optional(),
          country: z.string().min(2, 'Country is required'),
          postalCode: z.string().optional(),
        }),
      ]),
      contactPhone: z.string().min(5, 'Institutional contact phone is required').trim(),
      adminName: z.string().min(2, 'Admin full name must be at least 2 characters').trim(),
      adminEmail: z.string().email('Invalid admin email address').trim().toLowerCase(),
      designation: z.string().min(2, 'Designation / role is required').trim(),
      password: z.string().regex(passwordRegex, passwordMessage),
      confirmPassword: z.string(),
      adminPhone: z.string().optional(),
      desiredSlug: z
        .string()
        .regex(
          /^[a-z0-9-]+$/,
          'Tenant slug must be lowercase alphanumeric characters and hyphens only'
        )
        .min(2, 'Tenant slug must be at least 2 characters')
        .trim(),
      termsAccepted: z
        .boolean()
        .refine((val) => val === true, 'You must accept the Terms of Service & DPA'),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

const rejectOnboardingSchema = z.object({
  body: z.object({
    reason: z.string().min(5, 'A valid rejection reason of at least 5 characters is required').trim(),
  }),
});

module.exports = {
  studentRegisterSchema,
  verifyEmailSchema,
  tenantOnboardingSchema,
  rejectOnboardingSchema,
};
