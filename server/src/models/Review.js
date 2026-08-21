// Schema representing book & e-resource patron reviews and 5-star ratings.
// Rule: Define each field's indexing EITHER inline via schema options OR via explicit schema.index() calls, never both for the same field/combination.
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
    },
    resourceType: {
      type: String,
      enum: ['book', 'eresource'],
      default: 'book',
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    text: {
      type: String,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['approved', 'pending', 'flagged', 'rejected'],
      default: 'approved',
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
    votedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
reviewSchema.index({ userId: 1, bookId: 1 }, { unique: true, sparse: true });
reviewSchema.index({ collegeId: 1, resourceType: 1, resourceId: 1, status: 1 });
reviewSchema.index({ collegeId: 1, userId: 1, resourceId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Review', reviewSchema);
