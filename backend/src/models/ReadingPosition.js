const mongoose = require('mongoose');

const readingPositionSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EResource',
      required: true,
      index: true,
    },
    position: {
      type: String,
      required: false,
    },
    cfi: {
      type: String,
    },
    page: {
      type: Number,
    },
    progressPercentage: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Schema-level validation ensuring either cfi or page is set (matching EPUB vs PDF)
readingPositionSchema.pre('validate', function (next) {
  const hasCfi = this.cfi !== undefined && this.cfi !== null && this.cfi !== '';
  const hasPage = this.page !== undefined && this.page !== null;

  if (hasCfi && hasPage) {
    const err = new Error('ReadingPosition cannot specify both cfi and page simultaneously.');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (!hasCfi && !hasPage && !this.position) {
    const err = new Error('ReadingPosition requires at least cfi, page, or position payload.');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (typeof next === 'function') {
    next();
  }
});

// Compound unique index to track exactly one position per student per book
readingPositionSchema.index({ userId: 1, resourceId: 1 }, { unique: true });
readingPositionSchema.index({ collegeId: 1, userId: 1 });

module.exports = mongoose.model('ReadingPosition', readingPositionSchema);
