const mongoose = require('mongoose');

const bookVelocitySchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    borrowCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const dailyMetricSnapshotSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    metrics: {
      circulation: {
        loansIssued: { type: Number, default: 0, min: 0 },
        loansReturned: { type: Number, default: 0, min: 0 },
        activeLoans: { type: Number, default: 0, min: 0 },
        overdueLoans: { type: Number, default: 0, min: 0 },
        renewals: { type: Number, default: 0, min: 0 },
      },
      fines: {
        finesAccrued: { type: Number, default: 0, min: 0 },
        finesCollected: { type: Number, default: 0, min: 0 },
        finesWaived: { type: Number, default: 0, min: 0 },
        unpaidFinesTotal: { type: Number, default: 0, min: 0 },
      },
      utilization: {
        activePatrons: { type: Number, default: 0, min: 0 },
        catalogSearches: { type: Number, default: 0, min: 0 },
        eresourceViews: { type: Number, default: 0, min: 0 },
        facilitiesBookings: { type: Number, default: 0, min: 0 },
      },
      engagement: {
        activeStreaks: { type: Number, default: 0, min: 0 },
        badgesAwarded: { type: Number, default: 0, min: 0 },
        readingListAdds: { type: Number, default: 0, min: 0 },
      },
      bookVelocity: [bookVelocitySchema],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring 1 daily snapshot per college per calendar date
dailyMetricSnapshotSchema.index({ collegeId: 1, date: -1 }, { unique: true });

// Time-series query range index for analytical trend aggregations
dailyMetricSnapshotSchema.index({ collegeId: 1, 'metrics.circulation.loansIssued': -1 });

// TTL retention index: 365 days (1 year)
// Automatically purges records older than 365 days to maintain the Atlas 512 MB storage quota
dailyMetricSnapshotSchema.index({ date: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Helper to normalize timestamp to UTC calendar day start (00:00:00.000Z)
dailyMetricSnapshotSchema.statics.normalizeDate = function (inputDate) {
  const d = new Date(inputDate || Date.now());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

module.exports =
  mongoose.models.DailyMetricSnapshot ||
  mongoose.model('DailyMetricSnapshot', dailyMetricSnapshotSchema);
