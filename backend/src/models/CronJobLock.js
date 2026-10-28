const mongoose = require('mongoose');

/**
 * Distributed cron job lock schema for multi-instance cluster coordination.
 * When Redis is unavailable, MongoDB serves as the atomic lease provider.
 */
const cronJobLockSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: true,
      unique: true,
    },
    lockedBy: {
      type: String,
      required: true,
    },
    lockedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.CronJobLock || mongoose.model('CronJobLock', cronJobLockSchema);
