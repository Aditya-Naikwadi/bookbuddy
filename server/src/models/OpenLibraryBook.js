const mongoose = require('mongoose');

const openLibraryBookSchema = new mongoose.Schema(
  {
    openLibraryKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    authorNames: {
      type: [String],
      default: [],
      index: true,
    },
    firstPublishYear: {
      type: Number,
      index: true,
    },
    isbn: {
      type: [String],
      default: [],
      index: true,
    },
    coverImageUrl: {
      type: String,
      default: null,
    },
    subjects: {
      type: [String],
      default: [],
      index: true,
    },
    publisher: {
      type: [String],
      default: [],
    },
    lastIngestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Full-text search index across title and authors
openLibraryBookSchema.index({ title: 'text', authorNames: 'text' });

// Compound index for fast queries by subject and publish year
openLibraryBookSchema.index({ subjects: 1, firstPublishYear: -1 });

module.exports = mongoose.model('OpenLibraryBook', openLibraryBookSchema);
