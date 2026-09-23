import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moderateEResourceBodySchema } from '@shared/schemas/moderation';
import {
  studentRegisterBodySchema,
  verifyEmailBodySchema,
} from '@shared/schemas/auth';
import {
  rejectStudentJoinRequestBodySchema,
} from '@shared/schemas/joinRequests';
import {
  createBookingBodySchema,
  getLabAvailabilityQuerySchema,
} from '@shared/schemas/facilities';
import {
  createPaymentOrderBodySchema,
  verifyPaymentBodySchema,
} from '@shared/schemas/payments';

import apiClient from '../api/client';
import adminApi from '../api/adminApi';
import collegeAdminApi from '../api/collegeAdminApi';
import facilitiesApi from '../api/facilitiesApi';
import { createRazorpayOrder, verifyRazorpayPayment } from '../api/paymentApi';
import registrationApi from '../api/registrationApi';

describe('Frontend-Backend Contract Drift Safety Test Suite', () => {
  const validObjectId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. E-Resource Moderation Contract (Anti-Drift Protection)', () => {
    it('constructs valid approval payload through adminApi.moderateResource and passes schema validation', async () => {
      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: { success: true } });

      await adminApi.moderateResource(validObjectId, 'approved', 'Content verified.');

      expect(putSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledPayload] = putSpy.mock.calls[0];
      expect(calledUrl).toBe(`/dashboards/admin-portal/moderation/${validObjectId}`);

      // Assert payload strictly validates against the shared backend schema
      const parseResult = moderateEResourceBodySchema.safeParse(calledPayload);
      expect(parseResult.success).toBe(true);
      expect(parseResult.data.status).toBe('approved');
      expect(parseResult.data.note).toBe('Content verified.');
    });

    it('constructs valid rejection payload through collegeAdminApi.moderateEResource', async () => {
      const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: { success: true } });

      await collegeAdminApi.moderateEResource(validObjectId, {
        status: 'rejected',
        note: 'Scanned pages are unreadable and missing bibliography.',
      });

      expect(putSpy).toHaveBeenCalledTimes(1);
      const [, calledPayload] = putSpy.mock.calls[0];

      const parseResult = moderateEResourceBodySchema.safeParse(calledPayload);
      expect(parseResult.success).toBe(true);
      expect(parseResult.data.status).toBe('rejected');
      expect(parseResult.data.note).toBe('Scanned pages are unreadable and missing bibliography.');
    });

    it('SAFETY PROOF: catches re-introduced reason vs note drift immediately before network call', () => {
      // Simulating a drifted frontend payload using legacy { reason }
      const driftedPayload = {
        status: 'rejected',
        reason: 'Violates copyright guidelines.',
      };

      const result = moderateEResourceBodySchema.safeParse(driftedPayload);
      expect(result.success).toBe(false);

      const issues = result.error.issues || result.error.errors;
      const noteIssue = issues.find((i) => i.path.includes('note'));
      expect(noteIssue).toBeDefined();
      expect(noteIssue.message).toMatch(/rejection reason \(note\) is required/i);
    });
  });

  describe('2. User Registration Contract (Flow A Student & Email Verification)', () => {
    it('constructs student registration payload and validates against schema', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });

      const studentData = {
        name: 'Alex Mercer',
        email: 'alex.mercer@oxford.edu',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        collegeId: validObjectId,
        studentId: 'STU-9901',
        department: 'Physics',
        termsAccepted: true,
      };

      await registrationApi.registerStudent(studentData);

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, calledPayload] = postSpy.mock.calls[0];

      const parseResult = studentRegisterBodySchema.safeParse(calledPayload);
      expect(parseResult.success).toBe(true);
    });

    it('catches password mismatch drift in registration data', async () => {
      const mismatchedData = {
        name: 'Alex Mercer',
        email: 'alex.mercer@oxford.edu',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword456!',
        collegeId: validObjectId,
        studentId: 'STU-9901',
        termsAccepted: true,
      };

      await expect(registrationApi.registerStudent(mismatchedData)).rejects.toThrow();
    });

    it('constructs email verification OTP payload via registrationApi', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });

      await registrationApi.verifyStudentEmail({
        email: 'alex.mercer@oxford.edu',
        otp: '889922',
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, calledPayload] = postSpy.mock.calls[0];
      const parseResult = verifyEmailBodySchema.safeParse(calledPayload);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('3. Student Join-Request Contract', () => {
    it('constructs rejection payload with valid reason via collegeAdminApi', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });

      await collegeAdminApi.rejectStudentJoinRequest(validObjectId, {
        reason: 'Student ID was not located in university registrar batch CSV.',
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, calledPayload] = postSpy.mock.calls[0];

      const parseResult = rejectStudentJoinRequestBodySchema.safeParse(calledPayload);
      expect(parseResult.success).toBe(true);
      expect(parseResult.data.reason).toMatch(/not located/i);
    });

    it('rejects join request rejection when reason is shorter than 3 characters', async () => {
      await expect(
        collegeAdminApi.rejectStudentJoinRequest(validObjectId, { reason: 'no' })
      ).rejects.toThrow();
    });
  });

  describe('4. Facility & Lab Booking Contract', () => {
    it('constructs booking payload through facilitiesApi.createBooking and validates schema', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: { bookingId: 'b1' } } });

      const startTime = '2026-11-01T09:00:00.000Z';
      const endTime = '2026-11-01T11:00:00.000Z';

      await facilitiesApi.createBooking(validObjectId, startTime, endTime);

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, calledPayload] = postSpy.mock.calls[0];

      const parseResult = createBookingBodySchema.safeParse(calledPayload);
      expect(parseResult.success).toBe(true);
    });

    it('rejects inverted booking timestamps (startTime >= endTime)', async () => {
      const startTime = '2026-11-01T14:00:00.000Z';
      const endTime = '2026-11-01T10:00:00.000Z';

      await expect(
        facilitiesApi.createBooking(validObjectId, startTime, endTime)
      ).rejects.toThrow();
    });

    it('constructs availability query through facilitiesApi.getAvailability', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } });

      await facilitiesApi.getAvailability('Turing Lab', '2026-11-01');

      expect(getSpy).toHaveBeenCalledTimes(1);
      const [, config] = getSpy.mock.calls[0];
      const parseResult = getLabAvailabilityQuerySchema.safeParse(config.params);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('5. Payment Order Contract (AppSec Trust Boundary Safety)', () => {
    it('constructs clean payment order without client-supplied amount via paymentApi', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { orderId: 'ord_123' } });

      await createRazorpayOrder({ fineId: validObjectId, currency: 'INR' });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, calledPayload] = postSpy.mock.calls[0];

      const parseResult = createPaymentOrderBodySchema.safeParse(calledPayload);
      expect(parseResult.success).toBe(true);
      expect(calledPayload).not.toHaveProperty('amount');
      expect(calledPayload).not.toHaveProperty('clientAmount');
    });

    it('APPSEC TRUST BOUNDARY: strictly rejects client attempt to inject amount into paymentApi payload', () => {
      const maliciousPayload = {
        fineId: validObjectId,
        amount: 100, // Attack payload
      };

      const result = createPaymentOrderBodySchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
    });

    it('constructs valid Razorpay payment verification payload via paymentApi', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });

      const verifyData = {
        razorpay_order_id: 'order_998877',
        razorpay_payment_id: 'pay_112233',
        razorpay_signature: 'abc123def456789signature',
        fineId: validObjectId,
      };

      await verifyRazorpayPayment(verifyData);

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, calledPayload] = postSpy.mock.calls[0];

      const parseResult = verifyPaymentBodySchema.safeParse(calledPayload);
      expect(parseResult.success).toBe(true);
    });
  });
});
