const mongoose = require('mongoose');

const CollegeFeatureConfigSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      unique: true,
      index: true,
    },
    enabledFeatures: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    pendingRequests: [
      {
        featureId: { type: String, required: true },
        requestedAt: { type: Date, default: Date.now },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
      },
    ],
    customSettings: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CollegeFeatureConfig ||
  mongoose.model('CollegeFeatureConfig', CollegeFeatureConfigSchema);
