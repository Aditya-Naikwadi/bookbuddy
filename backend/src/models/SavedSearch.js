// Schema representing persisted user-specific search filters.
const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    queryParams: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      required: true,
    },
    alertsEnabled: {
      type: Boolean,
      default: false,
    },
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
