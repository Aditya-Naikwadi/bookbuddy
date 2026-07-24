const mongoose = require('mongoose');

const downloadLinksSchema = new mongoose.Schema(
  {
    epub: { type: String, default: null },
    pdf: { type: String, default: null },
    text: { type: String, default: null },
    readUrl: { type: String, default: null },
  },
  { _id: false }
);

const unifiedBookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    authors: {
      type: [String],
      default: [],
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    publishYear: {
      type: Number,
      default: null,
    },
    isbns: {
      type: [String],
      default: [],
      index: true,
    },
    coverImageUrl: {
      type: String,
      default: null,
    },
    downloadLinks: {
      type: downloadLinksSchema,
      default: () => ({}),
    },
    sources: {
      type: [String],
      default: [],
      index: true,
    },
    // Normalized key used for title + author secondary deduplication
    normalizedTitleAuthor: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Performance search index
unifiedBookSchema.index({ title: 'text', description: 'text' });

/**
 * Utility function to generate normalized key from title and authors array
 */
unifiedBookSchema.statics.generateNormalizedKey = function (title, authors) {
  const normTitle = (title || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
  const primaryAuthor = Array.isArray(authors) && authors.length > 0 ? authors[0] : '';
  const normAuthor = primaryAuthor.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${normTitle}:${normAuthor}`;
};

module.exports = mongoose.model('UnifiedBook', unifiedBookSchema);
