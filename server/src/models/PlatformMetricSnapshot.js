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
      index: true,
    },
    activeStudents: {
      type: Number,
      default: 0,
    },
    activeAdmins: {
      type: Number,
      default: 0,
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
    eResourcesCount: {
      type: Number,
      default: 0,
    },
    pendingModerationCount: {
      type: Number,
      default: 0,
    },
    storageUsageBytes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

platformMetricSnapshotSchema.index({ snapshotDate: -1 });
platformMetricSnapshotSchema.index({ collegeId: 1, snapshotDate: -1 });

module.exports = mongoose.model('PlatformMetricSnapshot', platformMetricSnapshotSchema);
