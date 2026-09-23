const { z } = require('zod');
const { objectIdSchema } = require('./common');

const createEResourceBodySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  type: z.enum(['pdf', 'epub', 'journal']),
  fileUrl: z.string().url('Invalid file URL'),
  category: z.string().min(1, 'Category is required'),
});

const createEResourceRouteSchema = z.object({
  body: createEResourceBodySchema,
});

const createReadingListBodySchema = z
  .object({
    name: z.string().min(1, 'Name is required').optional(),
    title: z.string().min(1, 'Title is required').optional(),
    description: z.string().optional(),
    visibility: z.enum(['private', 'college', 'public']).default('private'),
  })
  .refine((data) => data.name || data.title, {
    message: 'Either name or title is required',
    path: ['name'],
  });

const createReadingListRouteSchema = z.object({
  body: createReadingListBodySchema,
});

const updateReadingListBodySchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  visibility: z.enum(['private', 'college', 'public']).optional(),
  items: z
    .array(
      z.object({
        bookId: objectIdSchema.optional(),
        resourceType: z.enum(['book', 'eresource']).optional(),
        resourceId: objectIdSchema.optional(),
        addedAt: z.union([z.string(), z.date()]).optional(),
        note: z.string().optional(),
      })
    )
    .optional(),
});

const updateReadingListRouteSchema = z.object({
  body: updateReadingListBodySchema,
});

const addReadingListItemBodySchema = z
  .object({
    bookId: objectIdSchema.optional(),
    resourceId: objectIdSchema.optional(),
    resourceType: z.enum(['book', 'eresource']).optional(),
    note: z.string().optional(),
  })
  .refine((data) => data.bookId || data.resourceId, {
    message: 'Either bookId or resourceId is required',
    path: ['bookId'],
  });

const addReadingListItemRouteSchema = z.object({
  body: addReadingListItemBodySchema,
});

const updateProgressBodySchema = z.object({
  currentPage: z.number().int().min(1).optional(),
  epubProgress: z.string().optional(),
  dailySecondsToday: z.number().int().min(0).optional(),
  readingTimeMinutes: z.number().int().min(0).optional(),
});

const updateProgressRouteSchema = z.object({
  params: z.object({
    eresourceId: objectIdSchema,
  }),
  body: updateProgressBodySchema,
});

const createBookmarkBodySchema = z.object({
  eresourceId: objectIdSchema,
  locationRef: z.string().min(1, 'Location reference is required'),
  note: z.string().optional(),
});

const createBookmarkRouteSchema = z.object({
  body: createBookmarkBodySchema,
});

const createSavedSearchBodySchema = z.object({
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
});

const createSavedSearchRouteSchema = z.object({
  body: createSavedSearchBodySchema,
});

const toggleAlertsBodySchema = z.object({
  alertsEnabled: z.boolean(),
});

const toggleAlertsRouteSchema = z.object({
  body: toggleAlertsBodySchema,
});

module.exports = {
  createEResourceBodySchema,
  createEResourceRouteSchema,
  createEResourceSchema: createEResourceRouteSchema,
  createReadingListBodySchema,
  createReadingListRouteSchema,
  createReadingListSchema: createReadingListRouteSchema,
  updateReadingListBodySchema,
  updateReadingListRouteSchema,
  updateReadingListSchema: updateReadingListRouteSchema,
  addReadingListItemBodySchema,
  addReadingListItemRouteSchema,
  addReadingListItemSchema: addReadingListItemRouteSchema,
  updateProgressBodySchema,
  updateProgressRouteSchema,
  updateProgressSchema: updateProgressRouteSchema,
  createBookmarkBodySchema,
  createBookmarkRouteSchema,
  createBookmarkSchema: createBookmarkRouteSchema,
  createSavedSearchBodySchema,
  createSavedSearchRouteSchema,
  createSavedSearchSchema: createSavedSearchRouteSchema,
  toggleAlertsBodySchema,
  toggleAlertsRouteSchema,
  toggleAlertsSchema: toggleAlertsRouteSchema,
};
