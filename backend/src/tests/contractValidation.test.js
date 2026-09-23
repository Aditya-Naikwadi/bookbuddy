const mongoose = require('mongoose');
const {
  moderateEResourceBodySchema,
  moderateEResourceRouteSchema,
} = require('@bookbuddy/shared/schemas/moderation');
const {
  studentRegisterBodySchema,
  studentRegisterRouteSchema,
  registerBodySchema,
} = require('@bookbuddy/shared/schemas/auth');
const {
  rejectStudentJoinRequestBodySchema,
  rejectStudentJoinRequestRouteSchema,
  approveStudentJoinRequestRouteSchema,
} = require('@bookbuddy/shared/schemas/joinRequests');
const {
  createBookingBodySchema,
  createBookingRouteSchema,
  getLabAvailabilityQuerySchema,
} = require('@bookbuddy/shared/schemas/facilities');
const {
  createPaymentOrderBodySchema,
  createPaymentOrderRouteSchema,
  verifyPaymentBodySchema,
  verifyPaymentRouteSchema,
} = require('@bookbuddy/shared/schemas/payments');

describe('API Contract Validation Test Suite (Shared Zod Schemas)', () => {
  const validObjectId = new mongoose.Types.ObjectId().toString();

  describe('1. E-Resource Moderation Contract (Reason vs Note Anti-Drift Safety)', () => {
    it('approves valid approval payload', () => {
      const payload = {
        status: 'approved',
        note: 'Content verified and approved for platform-wide library access.',
      };
      const result = moderateEResourceBodySchema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('approved');
    });

    it('approves valid rejection payload with note', () => {
      const payload = {
        status: 'rejected',
        note: 'Violates copyright and plagiarism policy.',
      };
      const result = moderateEResourceBodySchema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('rejected');
      expect(result.data.note).toBe('Violates copyright and plagiarism policy.');
    });

    it('PROVES REASON/NOTE DRIFT CAUGHT: rejects payload when client sends legacy { reason } instead of { note }', () => {
      // Simulating frontend drift back to { status: "rejected", reason: "Bad PDF" }
      const driftedPayload = {
        status: 'rejected',
        reason: 'Bad PDF formatting and low scan quality.',
      };

      const result = moderateEResourceBodySchema.safeParse(driftedPayload);
      expect(result.success).toBe(false);

      const issues = result.error.issues || result.error.errors;
      const noteError = issues.find((e) => e.path.includes('note'));
      expect(noteError).toBeDefined();
      expect(noteError.message).toMatch(/rejection reason \(note\) is required/i);
    });

    it('rejects rejection payload when note is empty or missing', () => {
      const emptyNotePayload = {
        status: 'rejected',
        note: '   ',
      };
      const result = moderateEResourceBodySchema.safeParse(emptyNotePayload);
      expect(result.success).toBe(false);
    });

    it('validates full route schema for Express validate() middleware', () => {
      const routeReq = {
        params: { id: validObjectId },
        body: {
          status: 'approved',
          note: 'Verified.',
        },
      };
      const result = moderateEResourceRouteSchema.safeParse(routeReq);
      expect(result.success).toBe(true);
    });
  });

  describe('2. User Registration Contract (Role-Conditional CollegeId & Password Matching)', () => {
    it('validates student registration with matching passwords and valid collegeId', () => {
      const validStudent = {
        name: 'Jane Doe',
        email: 'jane@college.edu',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        collegeId: validObjectId,
        studentId: 'STU_2026_001',
        department: 'Computer Science',
        termsAccepted: true,
      };
      const result = studentRegisterBodySchema.safeParse(validStudent);
      expect(result.success).toBe(true);
    });

    it('fails when confirmPassword does not match password', () => {
      const mismatched = {
        name: 'Jane Doe',
        email: 'jane@college.edu',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
        collegeId: validObjectId,
        studentId: 'STU_2026_001',
        termsAccepted: true,
      };
      const result = studentRegisterBodySchema.safeParse(mismatched);
      expect(result.success).toBe(false);
      const issues = result.error.issues || result.error.errors;
      expect(issues[0].message).toMatch(/passwords do not match/i);
    });

    it('enforces collegeId requirement for college-student role in general registration', () => {
      const missingCollege = {
        name: 'Jane Doe',
        email: 'jane@college.edu',
        password: 'Password123!',
        role: 'college-student',
        studentId: 'STU_123',
      };
      const result = registerBodySchema.safeParse(missingCollege);
      expect(result.success).toBe(false);
      const issues = result.error.issues || result.error.errors;
      expect(issues[0].message).toMatch(/college selection is required/i);
    });
  });

  describe('3. Student Join-Request Contract', () => {
    it('validates approve join request route params', () => {
      const result = approveStudentJoinRequestRouteSchema.safeParse({
        params: { id: validObjectId },
      });
      expect(result.success).toBe(true);
    });

    it('validates rejection payload with valid reason', () => {
      const result = rejectStudentJoinRequestBodySchema.safeParse({
        reason: 'Enrollment ID could not be verified in college registrar database.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects join request rejection when reason is missing or shorter than 3 characters', () => {
      const resultMissing = rejectStudentJoinRequestBodySchema.safeParse({});
      expect(resultMissing.success).toBe(false);

      const resultShort = rejectStudentJoinRequestBodySchema.safeParse({ reason: 'no' });
      expect(resultShort.success).toBe(false);
    });
  });

  describe('4. Facility & Lab Booking Contract', () => {
    it('validates lab availability query', () => {
      const query = {
        labName: 'Turing Computer Lab',
        date: '2026-10-15',
      };
      const result = getLabAvailabilityQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    it('validates booking creation when startTime is strictly before endTime', () => {
      const booking = {
        seatId: validObjectId,
        startTime: '2026-10-15T09:00:00.000Z',
        endTime: '2026-10-15T11:00:00.000Z',
      };
      const result = createBookingBodySchema.safeParse(booking);
      expect(result.success).toBe(true);
    });

    it('rejects booking creation when startTime is after or equal to endTime', () => {
      const invertedTimes = {
        seatId: validObjectId,
        startTime: '2026-10-15T12:00:00.000Z',
        endTime: '2026-10-15T10:00:00.000Z',
      };
      const result = createBookingBodySchema.safeParse(invertedTimes);
      expect(result.success).toBe(false);
      const issues = result.error.issues || result.error.errors;
      expect(issues[0].message).toMatch(/startTime must be strictly before endTime/i);
    });
  });

  describe('5. Payment Order Contract (AppSec Trust Boundary Hardening)', () => {
    it('validates clean payment order with fineId and currency', () => {
      const payload = {
        fineId: validObjectId,
        currency: 'INR',
      };
      const result = createPaymentOrderBodySchema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(result.data.currency).toBe('INR');
    });

    it('validates clean payment order with multiple fineIds', () => {
      const payload = {
        fineIds: [validObjectId, new mongoose.Types.ObjectId().toString()],
      };
      const result = createPaymentOrderBodySchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('APPSEC TRUST BOUNDARY: strictly rejects any client-supplied amount or clientAmount', () => {
      const maliciousPayload = {
        fineId: validObjectId,
        amount: 100, // Client attempting to dictate order amount!
      };
      const result = createPaymentOrderBodySchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
      const issues = result.error.issues || result.error.errors;
      expect(issues[0].message).toMatch(
        /(?:unrecognized key.*amount|client-supplied payment amounts)/i
      );
    });

    it('APPSEC TRUST BOUNDARY: strictly rejects any client-supplied receipt parameter', () => {
      const payloadWithReceipt = {
        fineId: validObjectId,
        receipt: 'my_custom_receipt_123',
      };
      const result = createPaymentOrderBodySchema.safeParse(payloadWithReceipt);
      expect(result.success).toBe(false);
      const issues = result.error.issues || result.error.errors;
      expect(issues[0].message).toMatch(/(?:unrecognized key.*receipt|custom receipt parameters)/i);
    });

    it('validates payment verification payload with Razorpay signatures', () => {
      const verifyPayload = {
        razorpay_order_id: 'order_EKfLjbZ1g59fq6',
        razorpay_payment_id: 'pay_29QQoUBcxrhErq',
        razorpay_signature: '9ef4dffbfd84f1318f6739a3ce19f9d85851857c15a3000b73845182e52c497f',
        fineId: validObjectId,
      };
      const result = verifyPaymentBodySchema.safeParse(verifyPayload);
      expect(result.success).toBe(true);
    });
  });
});
