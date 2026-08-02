const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema(
  {
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
    type: {
      type: String,
      enum: ['highlight', 'note'],
      default: 'highlight',
    },
    cfiRange: {
      type: String,
    },
    page: {
      type: Number,
    },
    textRange: {
      type: mongoose.Schema.Types.Mixed,
    },
    text: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: 'yellow',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for user resource queries
annotationSchema.index({ userId: 1, resourceId: 1 });

// Full-text index on text and tags for annotation search
annotationSchema.index({ text: 'text', tags: 'text' }, { name: 'annotation_text_tags_search' });

// One-of-cfiRange-or-page validation pre-save hook matching ReadingPosition pattern
annotationSchema.pre('validate', function (next) {
  if (this.cfiRange && this.page !== undefined && this.page !== null) {
    const err = new Error('Annotation cannot specify both cfiRange and page simultaneously.');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (!this.cfiRange && (this.page === undefined || this.page === null)) {
    const err = new Error('Annotation requires at least cfiRange (EPUB) or page (PDF).');
    if (typeof next === 'function') return next(err);
    throw err;
  }
  if (typeof next === 'function') {
    next();
  }
});

module.exports = mongoose.model('Annotation', annotationSchema);
