const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const getAvailabilitySchema = z.object({
  query: z.object({
    labName: z.string().min(1, 'Lab name is required'),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  }),
});

const createBookingSchema = z.object({
  body: z.object({
    seatId: objectIdSchema,
    startTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid startTime format'),
    endTime: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid endTime format'),
  }),
});

const createSeatSchema = z.object({
  body: z.object({
    labName: z.string().min(1, 'Lab name is required'),
    seatNumber: z.string().min(1, 'Seat number is required'),
    specs: z.string().optional(),
    maintenanceStatus: z.enum(['operational', 'maintenance', 'retired']).optional(),
  }),
});

const updateSeatSchema = z.object({
  body: z.object({
    specs: z.string().optional(),
    maintenanceStatus: z.enum(['operational', 'maintenance', 'retired']).optional(),
  }),
});

const createSuggestionSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    author: z.string().min(1, 'Author is required'),
    reason: z.string().optional(),
  }),
});

const updateSuggestionSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'under_review', 'approved', 'rejected', 'acquired']),
    adminNote: z.string().optional(),
  }),
});

const createFeedbackSchema = z.object({
  body: z.object({
    category: z.enum(['general', 'facility', 'catalog', 'service']),
    message: z.string().min(1, 'Message is required'),
    rating: z.number().int().min(1).max(5).optional(),
  }),
});

const createComplaintSchema = z.object({
  body: z.object({
    subject: z.string().min(1, 'Subject is required'),
    description: z.string().min(1, 'Description is required'),
  }),
});

const resolveComplaintSchema = z.object({
  body: z.object({
    resolutionMessage: z.string().min(1, 'Resolution message is required'),
  }),
});

const updateNotificationPreferencesSchema = z.object({
  body: z
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
    .strict(),
});

module.exports = {
  getAvailabilitySchema,
  createBookingSchema,
  createSeatSchema,
  updateSeatSchema,
  createSuggestionSchema,
  updateSuggestionSchema,
  createFeedbackSchema,
  createComplaintSchema,
  resolveComplaintSchema,
  updateNotificationPreferencesSchema,
};
