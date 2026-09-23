const { z } = require('zod');
const { objectIdSchema } = require('./common');

/**
 * Lab availability query schema
 */
const getLabAvailabilityQuerySchema = z.object({
  labName: z.string().trim().min(1, 'Lab name is required'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
});

const getLabAvailabilityRouteSchema = z.object({
  query: getLabAvailabilityQuerySchema,
});

/**
 * Facility / Lab booking creation schema
 */
const createBookingBodySchema = z
  .object({
    seatId: objectIdSchema,
    startTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid startTime format'),
    endTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid endTime format'),
  })
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: 'startTime must be strictly before endTime',
    path: ['endTime'],
  });

const createBookingRouteSchema = z.object({
  body: createBookingBodySchema,
});

const createSeatBodySchema = z.object({
  labName: z.string().min(1, 'Lab name is required'),
  seatNumber: z.string().min(1, 'Seat number is required'),
  specs: z.string().optional(),
  maintenanceStatus: z.enum(['operational', 'maintenance', 'retired']).optional(),
});

const createSeatRouteSchema = z.object({
  body: createSeatBodySchema,
});

const updateSeatBodySchema = z.object({
  specs: z.string().optional(),
  maintenanceStatus: z.enum(['operational', 'maintenance', 'retired']).optional(),
});

const updateSeatRouteSchema = z.object({
  body: updateSeatBodySchema,
});

const createSuggestionBodySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  reason: z.string().optional(),
});

const createSuggestionRouteSchema = z.object({
  body: createSuggestionBodySchema,
});

const updateSuggestionBodySchema = z.object({
  status: z.enum(['pending', 'under_review', 'approved', 'rejected', 'acquired']),
  adminNote: z.string().optional(),
});

const updateSuggestionRouteSchema = z.object({
  body: updateSuggestionBodySchema,
});

const createFeedbackBodySchema = z.object({
  category: z.enum(['general', 'facility', 'catalog', 'service']),
  message: z.string().min(1, 'Message is required'),
  rating: z.number().int().min(1).max(5).optional(),
});

const createFeedbackRouteSchema = z.object({
  body: createFeedbackBodySchema,
});

const createComplaintBodySchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(1, 'Description is required'),
});

const createComplaintRouteSchema = z.object({
  body: createComplaintBodySchema,
});

const resolveComplaintBodySchema = z.object({
  resolutionMessage: z.string().min(1, 'Resolution message is required'),
});

const resolveComplaintRouteSchema = z.object({
  body: resolveComplaintBodySchema,
});

const updateNotificationPreferencesBodySchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    typePreferences: z
      .record(
        z.enum([
          'hold_ready',
          'fine_issued',
          'complaint_resolved',
          'streak_milestone',
          'streak_at_risk',
          'general',
        ]),
        z.boolean()
      )
      .optional(),
  })
  .strict();

const updateNotificationPreferencesRouteSchema = z.object({
  body: updateNotificationPreferencesBodySchema,
});

module.exports = {
  getLabAvailabilityQuerySchema,
  getLabAvailabilityRouteSchema,
  getAvailabilitySchema: getLabAvailabilityRouteSchema,
  createBookingBodySchema,
  createBookingRouteSchema,
  createBookingSchema: createBookingRouteSchema,
  createSeatBodySchema,
  createSeatRouteSchema,
  createSeatSchema: createSeatRouteSchema,
  updateSeatBodySchema,
  updateSeatRouteSchema,
  updateSeatSchema: updateSeatRouteSchema,
  createSuggestionBodySchema,
  createSuggestionRouteSchema,
  createSuggestionSchema: createSuggestionRouteSchema,
  updateSuggestionBodySchema,
  updateSuggestionRouteSchema,
  updateSuggestionSchema: updateSuggestionRouteSchema,
  createFeedbackBodySchema,
  createFeedbackRouteSchema,
  createFeedbackSchema: createFeedbackRouteSchema,
  createComplaintBodySchema,
  createComplaintRouteSchema,
  createComplaintSchema: createComplaintRouteSchema,
  resolveComplaintBodySchema,
  resolveComplaintRouteSchema,
  resolveComplaintSchema: resolveComplaintRouteSchema,
  updateNotificationPreferencesBodySchema,
  updateNotificationPreferencesRouteSchema,
  updateNotificationPreferencesSchema: updateNotificationPreferencesRouteSchema,
};
