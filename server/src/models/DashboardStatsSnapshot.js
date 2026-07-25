const mongoose = require('mongoose');

const dashboardStatsSnapshotSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      unique: true,
      index: true,
    },
    totalCatalogBooks: {
      type: Number,
      default: 0,
      min: 0,
    },
    addedThisMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    categoryBreakdown: [
      {
        label: { type: String, required: true },
        value: { type: Number, required: true },
        count: { type: Number, required: true },
        color: { type: String, required: true },
      },
    ],
    lastPrecomputedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast tenant snapshot retrieval
dashboardStatsSnapshotSchema.index({ collegeId: 1, updatedAt: -1 });

module.exports = mongoose.model('DashboardStatsSnapshot', dashboardStatsSnapshotSchema);
