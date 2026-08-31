const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EResource',
      required: true,
      index: true,
    },
    clientId: {
      type: String,
      unique: true,
      sparse: true,
    },
    type: {
      type: String,
      enum: ['bookmark', 'highlight', 'note'],
      default: 'highlight',
      required: true,
    },
    cfiRange: {
      type: String,
      trim: true,
    },
    page: {
      type: Number,
    },
    rects: {
      type: mongoose.Schema.Types.Mixed,
    },
    textRange: {
      type: mongoose.Schema.Types.Mixed,
    },
    textOffset: {
      type: mongoose.Schema.Types.Mixed,
    },
    highlightText: {
      type: String,
      maxlength: [2000, 'Highlight text cannot exceed 2000 characters'],
    },
    noteText: {
      type: String,
      maxlength: [5000, 'Note text cannot exceed 5000 characters'],
    },
    label: {
      type: String,
      trim: true,
      maxlength: [250, 'Bookmark label cannot exceed 250 characters'],
    },
    text: {
      type: String,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias: resourceId maps to bookId for backward compatibility
annotationSchema
  .virtual('resourceId')
  .get(function () {
    return this.bookId;
  })
  .set(function (val) {
    this.bookId = val;
  });

// Compound index for user book type queries
annotationSchema.index({ userId: 1, collegeId: 1, bookId: 1, type: 1 });

// Sparse unique index on clientId for offline sync idempotency
annotationSchema.index({ clientId: 1 }, { unique: true, sparse: true });

// Full-text search index
annotationSchema.index(
  { highlightText: 'text', noteText: 'text', label: 'text', tags: 'text' },
  { name: 'annotation_search_index' }
);

// Pre-validate hook
annotationSchema.pre('validate', function (next) {
  // Sync resourceId to bookId if bookId is not explicitly set
  if (!this.bookId && this.resourceId) {
    this.bookId = this.resourceId;
  }

  // Ensure text snapshot length cap
  if (this.highlightText && this.highlightText.length > 2000) {
    this.highlightText = this.highlightText.substring(0, 2000);
  }

  // Backwards compatibility for legacy text field
  if (!this.text) {
    this.text = this.highlightText || this.noteText || this.label || 'Annotation';
  }

  if (this.noteText && this.noteText.length > 5000) {
    const err = new Error('Note text cannot exceed 5000 characters.');
    err.name = 'ValidationError';
    if (typeof next === 'function') return next(err);
    throw err;
  }

  if (typeof next === 'function') {
    next();
  }
});

module.exports = mongoose.model('Annotation', annotationSchema);
