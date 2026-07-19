const mongoose = require('mongoose');

const readingActivityLogSchema = new mongoose.Schema(
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
      required: false,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    pagesRead: {
      type: Number,
      default: 0,
      min: 0,
    },
    minutesRead: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes supporting fast day-bucketed updates and date range aggregations
readingActivityLogSchema.index({ userId: 1, resourceId: 1, date: 1 });
readingActivityLogSchema.index({ userId: 1, date: -1 });
readingActivityLogSchema.index({ collegeId: 1, userId: 1, date: -1 });

module.exports = mongoose.model('ReadingActivityLog', readingActivityLogSchema);
