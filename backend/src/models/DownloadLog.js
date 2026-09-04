const mongoose = require('mongoose');

const downloadLogSchema = new mongoose.Schema(
  {
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
    downloadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

downloadLogSchema.index({ userId: 1, resourceId: 1, downloadedAt: -1 });

module.exports = mongoose.model('DownloadLog', downloadLogSchema);
