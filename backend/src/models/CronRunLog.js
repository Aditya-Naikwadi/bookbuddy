const mongoose = require('mongoose');

const cronRunLogSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    finishedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
      index: true,
    },
    affectedCount: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual Aliases for Blueprint Spec Compatibility
cronRunLogSchema
  .virtual('errorDetails')
  .get(function () {
    return this.errorMessage;
  })
  .set(function (v) {
    this.errorMessage = v;
  });

cronRunLogSchema
  .virtual('executedAt')
  .get(function () {
    return this.startedAt;
  })
  .set(function (v) {
    this.startedAt = v;
  });

cronRunLogSchema.set('toJSON', { virtuals: true });
cronRunLogSchema.set('toObject', { virtuals: true });

// 30-day TTL index for log retention
cronRunLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
cronRunLogSchema.index({ startedAt: -1 });

module.exports = mongoose.model('CronRunLog', cronRunLogSchema);
