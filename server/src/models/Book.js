// Schema representing physical and digital book assets in the catalog.
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    isbn: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      enum: ['physical', 'digital'],
      default: 'physical',
    },
    copiesTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    copiesAvailable: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    shelfLocation: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for dashboard and catalog queries
bookSchema.index({ collegeId: 1, category: 1 });
bookSchema.index({ collegeId: 1, copiesAvailable: -1, title: 1 });
bookSchema.index({ collegeId: 1, createdAt: -1 });

// Text index for search
bookSchema.index({ title: 'text', author: 'text' });

// Algolia Search Index Sync Hooks
bookSchema.post('save', async function (doc) {
  try {
    const { saveBookToAlgolia } = require('../utils/algolia');
    await saveBookToAlgolia(doc);
  } catch {
    // Non-blocking
  }
});

bookSchema.post('findOneAndDelete', async function (doc) {
  if (doc && doc._id) {
    try {
      const { deleteBookFromAlgolia } = require('../utils/algolia');
      await deleteBookFromAlgolia(doc._id);
    } catch {
      // Non-blocking
    }
  }
});

module.exports = mongoose.model('Book', bookSchema);
