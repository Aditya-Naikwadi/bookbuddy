// Schema representing college/institution tenants.
const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shortName: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    institutionType: {
      type: String,
      enum: ['university', 'college', 'school', 'training_institute'],
      default: 'college',
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    maxFineLimit: {
      type: Number,
      default: 100,
    },
    status: {
      type: String,
      enum: ['pending', 'pending_review', 'active', 'suspended', 'archived', 'rejected'],
      default: 'pending',
      index: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    configuredDepartments: [
      {
        type: String,
        trim: true,
      },
    ],
    selectedServices: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    enabledFeatures: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    featureLimits: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('College', collegeSchema);
