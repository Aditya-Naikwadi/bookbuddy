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
      default: 'active',
      index: true,
    },
    creationPath: {
      type: String,
      enum: ['self_service', 'operator_direct'],
      default: 'operator_direct',
    },
    createdVia: {
      type: String,
      enum: ['self_service', 'operator_direct'],
      default: 'operator_direct',
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
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
    subscriptionPlan: {
      type: String,
      default: 'standard',
    },
    licenseTier: {
      type: String,
      enum: ['basic', 'professional', 'enterprise'],
      default: 'basic',
    },
    tierLimits: {
      maxPatrons: { type: Number, default: 500 },
      maxStorageBytes: { type: Number, default: 10737418240 }, // 10 GB
      customSubdomainAllowed: { type: Boolean, default: false },
      allowAnalytics: { type: Boolean, default: true },
    },
    domainVerificationToken: {
      type: String,
      default: null,
    },
    isDomainVerified: {
      type: Boolean,
      default: false,
    },
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    formerSlugs: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    allowedFeatures: {
      eReaderEnabled: { type: Boolean, default: true },
      labBookingEnabled: { type: Boolean, default: true },
      aiRecommendationsEnabled: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Virtual Aliases for Blueprint Spec Compatibility
collegeSchema
  .virtual('tier')
  .get(function () {
    return this.subscriptionPlan;
  })
  .set(function (v) {
    this.subscriptionPlan = v;
  });

collegeSchema.set('toJSON', { virtuals: true });
collegeSchema.set('toObject', { virtuals: true });

// Auto-generate slug if missing and track formerSlugs on change
collegeSchema.pre('save', async function (next) {
  if (!this.slug && this.name) {
    let baseSlug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = 'college';

    let candidateSlug = baseSlug;
    let counter = 1;
    const College = mongoose.model('College');
    while (await College.exists({ slug: candidateSlug, _id: { $ne: this._id } })) {
      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    this.slug = candidateSlug;
  }

  if (this.createdVia && !this.creationPath) {
    this.creationPath = this.createdVia;
  } else if (this.creationPath && !this.createdVia) {
    this.createdVia = this.creationPath;
  }
  if (typeof next === 'function') {
    next();
  }
});

// Text search index for full-text search across tenant names and codes
collegeSchema.index({ name: 'text', code: 'text' });

// Compound indexes for directory filtering and sorting
collegeSchema.index({ status: 1, createdAt: -1 });
collegeSchema.index({ status: 1, subscriptionPlan: 1 });

module.exports = mongoose.model('College', collegeSchema);
