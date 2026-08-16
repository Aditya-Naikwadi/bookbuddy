const mongoose = require('mongoose');

const platformMetricSnapshotSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      default: null, // null indicates global platform-wide snapshot
      index: true,
    },
    snapshotDate: {
      type: Date,
      default: Date.now,
    },
    totalColleges: {
      type: Number,
      default: 0,
    },
    activeColleges: {
      type: Number,
      default: 0,
    },
    pendingColleges: {
      type: Number,
      default: 0,
    },
    totalStudents: {
      type: Number,
      default: 0,
    },
    activeStudents: {
      type: Number,
      default: 0,
    },
    activeAdmins: {
      type: Number,
      default: 0,
    },
    featureAdoptionBreakdown: [
      {
        featureKey: { type: String, required: true },
        collegeCount: { type: Number, default: 0 },
      },
    ],
    eResourcesCount: {
      type: Number,
      default: 0,
    },
    pendingModerationCount: {
      type: Number,
      default: 0,
    },
    eResourceMetrics: {
      totalUploaded: { type: Number, default: 0 },
      pendingModeration: { type: Number, default: 0 },
      approvedCount: { type: Number, default: 0 },
      rejectedCount: { type: Number, default: 0 },
    },
    activeLoans: {
      type: Number,
      default: 0,
    },
    overdueLoans: {
      type: Number,
      default: 0,
    },
    totalFinesPending: {
      type: Number,
      default: 0,
    },
    totalFinesCollected: {
      type: Number,
      default: 0,
    },
    storageUsageBytes: {
      type: Number,
      default: 0,
    },
    healthIndex: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    collection: 'platformmetricsnapshots',
  }
);

/* -------------------------------------------------------------------------- */
/*                                INDEXES                                     */
/* -------------------------------------------------------------------------- */

// Global & Per-College Snapshot Lookup Index (Hot Path)
platformMetricSnapshotSchema.index({ collegeId: 1, snapshotDate: -1 });

// Time-Series Trend History Index
platformMetricSnapshotSchema.index({ snapshotDate: -1 });

// TTL Retention Index (90-day hot retention auto-purge)
platformMetricSnapshotSchema.index({ snapshotDate: 1 }, { expireAfterSeconds: 7776000 });

const Model =
  mongoose.models.PlatformMetricSnapshot ||
  mongoose.model('PlatformMetricSnapshot', platformMetricSnapshotSchema);
if (!mongoose.models.PlatformMetricsSnapshot) {
  mongoose.model('PlatformMetricsSnapshot', platformMetricSnapshotSchema);
}

module.exports = Model;
