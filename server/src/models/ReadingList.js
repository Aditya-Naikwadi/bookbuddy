// Schema representing curated collections of catalog items.
const mongoose = require('mongoose');

const readingListSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    visibility: {
      type: String,
      enum: ['private', 'public'],
      default: 'private',
      index: true,
    },
    items: [
      {
        resourceType: {
          type: String,
          enum: ['book', 'eresource'],
          required: true,
        },
        resourceId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes
readingListSchema.index({ collegeId: 1, visibility: 1 });
readingListSchema.index({ ownerId: 1 });

module.exports = mongoose.model('ReadingList', readingListSchema);
