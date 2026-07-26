const mongoose = require('mongoose');

const FeatureCatalogSchema = new mongoose.Schema(
  {
    featureId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      enum: ['core', 'academic', 'facility', 'engagement', 'analytics'],
      default: 'academic',
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    version: {
      type: Number,
      default: 1,
    },
    isDeprecated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.FeatureCatalog || mongoose.model('FeatureCatalog', FeatureCatalogSchema);
