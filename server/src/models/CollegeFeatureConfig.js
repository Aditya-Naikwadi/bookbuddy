const mongoose = require('mongoose');

const collegeFeatureConfigSchema = new mongoose.Schema(
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
        featureKey: { type: String, required: true },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        requestedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CollegeFeatureConfig', collegeFeatureConfigSchema);
