// Zod input validation schemas for e-resource moderation and user personalization actions.
const { z } = require('zod');

const createEResourceSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    author: z.string().min(1, 'Author is required'),
    type: z.enum(['pdf', 'epub', 'journal']),
    fileUrl: z.string().url('Invalid file URL'),
    category: z.string().min(1, 'Category is required'),
  }),
});

const createReadingListSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    visibility: z.enum(['private', 'public']).default('private'),
  }),
});

const updateReadingListSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    visibility: z.enum(['private', 'public']).optional(),
  }),
});

const addReadingListItemSchema = z.object({
  body: z.object({
    resourceType: z.enum(['book', 'eresource']),
    resourceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Resource ID format'),
  }),
});

const updateProgressSchema = z.object({
  params: z.object({
    eresourceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid EResource ID format'),
  }),
  body: z.object({
    currentPage: z.number().int().min(1).optional(),
    epubProgress: z.string().optional(),
    dailySecondsToday: z.number().int().min(0).optional(),
    readingTimeMinutes: z.number().int().min(0).optional(),
  }),
});

const createBookmarkSchema = z.object({
  body: z.object({
    eresourceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid EResource ID format'),
    locationRef: z.string().min(1, 'Location reference is required'),
    note: z.string().optional(),
  }),
});

const createSavedSearchSchema = z.object({
  body: z.object({
    queryParams: z
      .object({
        category: z.string().optional(),
        keyword: z.string().optional(),
        format: z.enum(['physical', 'digital']).optional(),
        author: z.string().optional(),
        title: z.string().optional(),
        isbn: z.string().optional(),
      })
      .strict('Query parameters contains unrecognized keys'),
    alertsEnabled: z.boolean().optional(),
  }),
});

const toggleAlertsSchema = z.object({
  body: z.object({
    alertsEnabled: z.boolean(),
  }),
});

const moderateSchema = z.object({
  body: z.object({
    status: z.enum(['approved', 'rejected']),
    note: z.string().optional(),
  }),
});

module.exports = {
  createEResourceSchema,
  createReadingListSchema,
  updateReadingListSchema,
  addReadingListItemSchema,
  updateProgressSchema,
  createBookmarkSchema,
  createSavedSearchSchema,
  toggleAlertsSchema,
  moderateSchema,
};
