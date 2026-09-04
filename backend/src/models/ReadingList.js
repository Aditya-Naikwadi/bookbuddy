// Schema representing curated collections of catalog items / reading lists (shelves).
// Rule: Define each field's indexing EITHER inline via schema options OR via explicit schema.index() calls, never both for the same field/combination.
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    resourceType: {
      type: String,
      enum: ['book', 'eresource'],
      default: 'book',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const readingListSchema = new mongoose.Schema(
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
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    visibility: {
      type: String,
      enum: ['private', 'college', 'public'],
      default: 'private',
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    collaboratorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    items: [itemSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, getters: true },
    toObject: { virtuals: true, getters: true },
  }
);

// Synchronization pre-validate hook for backward compatibility between userId <-> ownerId and name <-> title
readingListSchema.pre('validate', function (next) {
  if (this.userId && !this.ownerId) {
    this.ownerId = this.userId;
  } else if (this.ownerId && !this.userId) {
    this.userId = this.ownerId;
  }

  if (this.name && !this.title) {
    this.title = this.name;
  } else if (this.title && !this.name) {
    this.name = this.title;
  }

  if (!this.name && !this.title) {
    this.name = 'Untitled Reading List';
    this.title = 'Untitled Reading List';
  }

  if (typeof next === 'function') {
    next();
  }
});

// Compound indexes
readingListSchema.index({ collegeId: 1, visibility: 1 });
readingListSchema.index({ collegeId: 1, tags: 1 });
readingListSchema.index({ collegeId: 1, userId: 1 });

module.exports = mongoose.model('ReadingList', readingListSchema);
