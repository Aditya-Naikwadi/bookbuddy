// Schema representing user-generated text highlights and notes on digital assets.
const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eresourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EResource',
      required: false,
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      default: null,
      index: true,
    },
    bookId: {
      type: mongoose.Schema.Types.Mixed,
      index: true,
    },
    locationRef: {
      type: String,
      required: false,
    },
    bookTitle: {
      type: String,
    },
    page: {
      type: Number,
    },
    cfi: {
      type: String,
    },
    highlightText: {
      type: String,
    },
    noteText: {
      type: String,
    },
    note: {
      type: String,
    },
    color: {
      type: String,
      default: 'yellow',
    },
    tags: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes matching user access patterns
bookmarkSchema.index({ userId: 1, eresourceId: 1 });
bookmarkSchema.index({ userId: 1, eresourceId: 1, locationRef: 1 });
bookmarkSchema.index({ userId: 1, bookId: 1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
