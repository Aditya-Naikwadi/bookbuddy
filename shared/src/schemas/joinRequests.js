const { z } = require('zod');
const { objectIdSchema } = require('./common');

/**
 * Approve student join request params
 */
const approveStudentJoinRequestRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

/**
 * Reject student join request: canonical payload schema enforcing 'reason'
 */
const rejectStudentJoinRequestBodySchema = z.object({
  reason: z
    .string({
      required_error: 'Rejection reason is required',
    })
    .trim()
    .min(3, 'Rejection reason must be at least 3 characters long'),
});

const rejectStudentJoinRequestRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: rejectStudentJoinRequestBodySchema,
});

module.exports = {
  approveStudentJoinRequestRouteSchema,
  rejectStudentJoinRequestBodySchema,
  rejectStudentJoinRequestRouteSchema,
};
