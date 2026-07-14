// Schema representing individual reading completion markers.
const mongoose = require('mongoose');

const readingProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eresourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EResource',
      required: true,
    },
    currentPage: {
      type: Number,
      min: 1,
    },
    epubProgress: {
      type: String,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index (enforces one progress record per user per e-resource)
readingProgressSchema.index({ userId: 1, eresourceId: 1 }, { unique: true });

module.exports = mongoose.model('ReadingProgress', readingProgressSchema);
