const { z } = require('zod');

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const paramIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

const paramBookIdSchema = z.object({
  params: z.object({
    bookId: objectIdSchema,
  }),
});

const paramEResourceIdSchema = z.object({
  params: z.object({
    eresourceId: objectIdSchema,
  }),
});

const paramGutenbergIdSchema = z.object({
  params: z.object({
    gutenbergId: z.string().regex(/^\d+$/, 'Invalid Gutenberg ID format (must be numeric)'),
  }),
});

const paramIdAndItemIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    itemId: objectIdSchema,
  }),
});

module.exports = {
  objectIdSchema,
  paramIdSchema,
  paramBookIdSchema,
  paramEResourceIdSchema,
  paramGutenbergIdSchema,
  paramIdAndItemIdSchema,
};
