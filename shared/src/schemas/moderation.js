const { z } = require('zod');
const { objectIdSchema } = require('./common');

/**
 * Request body for e-resource moderation action.
 * Enforces status ('approved' | 'rejected') and mandatory 'note' on rejection.
 * Eliminates legacy 'reason' vs 'note' naming ambiguity.
 */
const moderateEResourceBodySchema = z
  .object({
    status: z.enum(['approved', 'rejected'], {
      errorMap: () => ({ message: "Status must be either 'approved' or 'rejected'." }),
    }),
    note: z.string().trim().optional().default(''),
  })
  .refine(
    (data) => {
      if (data.status === 'rejected') {
        return typeof data.note === 'string' && data.note.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Rejection reason (note) is required when rejecting a resource.',
      path: ['note'],
    }
  );

/**
 * Full route schema for Express validate() middleware
 */
const moderateEResourceRouteSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: moderateEResourceBodySchema,
});

module.exports = {
  moderateEResourceBodySchema,
  moderateEResourceRouteSchema,
};
