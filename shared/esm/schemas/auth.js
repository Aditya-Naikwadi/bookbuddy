import { z  } from 'zod';
import { objectIdSchema  } from './common.js';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const passwordMessage =
  'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&), or be a passphrase of at least 16 characters';

const COMMON_BREACHED_PASSWORDS = new Set([
  'password',
  'password123',
  'admin123',
  '12345678',
  '123456789',
  'qwertyuiop',
  'letmein123',
]);

const validateSecurePassword = (val) => {
  if (typeof val !== 'string') return false;
  if (val.length < 8) return false;
  if (COMMON_BREACHED_PASSWORDS.has(val.toLowerCase())) return false;
  // OWASP: Allow long passphrases (>= 16 characters) without arbitrary character composition restrictions
  if (val.length >= 16) return true;
  return passwordRegex.test(val);
};

/**
 * Student registration payload schema (Flow A)
 */
const studentRegisterBodySchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters').trim(),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().refine(validateSecurePassword, passwordMessage),
    confirmPassword: z.string(),
    collegeId: objectIdSchema,
    studentId: z.string().trim().toLowerCase().min(2, 'Student / Enrollment ID is required'),
    department: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    termsAccepted: z
      .boolean()
      .refine((val) => val === true, 'You must accept the Terms and Privacy Policy'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const studentRegisterRouteSchema = z.object({
  body: studentRegisterBodySchema,
});

/**
 * General user registration schema with role-conditional collegeId
 */
const registerBodySchema = z
  .object({
    studentId: z.string().trim().toLowerCase().optional(),
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    role: z
      .enum(['student', 'college-student', 'general'], {
        errorMap: () => ({
          message:
            'Direct registration for administrative roles is not permitted. Please use institutional tenant onboarding.',
        }),
      })
      .default('student'),
    collegeId: objectIdSchema.optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.role === 'college-student' || (data.role === 'student' && data.studentId)) {
        return Boolean(data.collegeId && typeof data.collegeId === 'string' && data.collegeId.trim());
      }
      return true;
    },
    {
      message: 'College selection is required. Please select your institution.',
      path: ['collegeId'],
    }
  );

const registerRouteSchema = z.object({
  body: registerBodySchema,
});

const verifyEmailBodySchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  otp: z.string().min(4, 'OTP is required').trim(),
});

const verifyEmailRouteSchema = z.object({
  body: verifyEmailBodySchema,
});

/**
 * User Login Schema
 */
const loginBodySchema = z
  .object({
    email: z.string().trim().optional(),
    studentId: z.string().trim().optional(),
    password: z.string().min(1, 'Password is required'),
    totpCode: z.string().optional(),
    collegeSlug: z.string().trim().optional(),
    collegeId: objectIdSchema.optional(),
  })
  .refine((data) => data.email || data.studentId, {
    message: 'Either email or studentId must be provided',
    path: ['email'],
  });

const loginRouteSchema = z.object({
  body: loginBodySchema,
});

/**
 * Token Refresh Schema
 */
const refreshBodySchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .optional();

const refreshRouteSchema = z.object({
  body: refreshBodySchema,
});

/**
 * Tenant Onboarding Schema
 */
const tenantOnboardingBodySchema = z
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
  });

const tenantOnboardingRouteSchema = z.object({
  body: tenantOnboardingBodySchema,
});

const rejectOnboardingBodySchema = z.object({
  reason: z
    .string()
    .min(5, 'A valid rejection reason of at least 5 characters is required')
    .trim(),
});

const rejectOnboardingRouteSchema = z.object({
  body: rejectOnboardingBodySchema,
});

export {
  passwordRegex,
  passwordMessage,
  studentRegisterBodySchema,
  studentRegisterRouteSchema,
  registerBodySchema,
  registerRouteSchema,
  registerRouteSchema as registerSchema,
  verifyEmailBodySchema,
  verifyEmailRouteSchema,
  loginBodySchema,
  loginRouteSchema,
  loginRouteSchema as loginSchema,
  refreshBodySchema,
  refreshRouteSchema,
  refreshRouteSchema as refreshSchema,
  tenantOnboardingBodySchema,
  tenantOnboardingRouteSchema,
  tenantOnboardingRouteSchema as tenantOnboardingSchema,
  rejectOnboardingBodySchema,
  rejectOnboardingRouteSchema,
  rejectOnboardingRouteSchema as rejectOnboardingSchema,
};
export default {
  passwordRegex,
  passwordMessage,
  studentRegisterBodySchema,
  studentRegisterRouteSchema,
  registerBodySchema,
  registerRouteSchema,
  registerSchema: registerRouteSchema,
  verifyEmailBodySchema,
  verifyEmailRouteSchema,
  loginBodySchema,
  loginRouteSchema,
  loginSchema: loginRouteSchema,
  refreshBodySchema,
  refreshRouteSchema,
  refreshSchema: refreshRouteSchema,
  tenantOnboardingBodySchema,
  tenantOnboardingRouteSchema,
  tenantOnboardingSchema: tenantOnboardingRouteSchema,
  rejectOnboardingBodySchema,
  rejectOnboardingRouteSchema,
  rejectOnboardingSchema: rejectOnboardingRouteSchema,
};
