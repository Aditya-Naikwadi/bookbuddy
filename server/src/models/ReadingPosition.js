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
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to track exactly one position per student per book
readingPositionSchema.index({ userId: 1, resourceId: 1 }, { unique: true });
readingPositionSchema.index({ collegeId: 1, userId: 1 });

module.exports = mongoose.model('ReadingPosition', readingPositionSchema);
