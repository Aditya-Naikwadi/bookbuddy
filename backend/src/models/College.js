// Schema representing college/institution tenants.
const mongoose = require('mongoose');
const { validateSlugFormat, isSlugReserved } = require('../constants/reservedSlugs');

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
      validate: {
        validator: function (v) {
          if (!v) return true;
          const { valid } = validateSlugFormat(v);
          return valid;
        },
        message: function (props) {
          const { reason } = validateSlugFormat(props.value);
          return reason || 'Invalid college slug.';
        },
      },
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
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    facilitySettings: {
      maxWeeklyWorkstationHours: { type: Number, default: 12 },
      maxWeeklySeatHours: { type: Number, default: 30 },
      workstationAdvanceHorizonHours: { type: Number, default: 1 },
      seatAdvanceHorizonDays: { type: Number, default: 1 },
      checkInGraceMinutes: { type: Number, default: 10 },
      capScope: { type: String, enum: ['college', 'branch'], default: 'college' },
      // Backward compatibility fields
      maxWeeklyHours: { type: Number, default: 12 },
      advanceBookingDays: { type: Number, default: 7 },
      noShowPenaltyWindowDays: { type: Number, default: 14 },
      noShowMaxStrikes: { type: Number, default: 3 },
      noShowSuspensionHours: { type: Number, default: 48 },
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

// Auto-generate slug if missing, validate reserved words, and enforce immutability
collegeSchema.pre('save', async function () {
  const College = mongoose.model('College');

  // Enforce slug immutability once established
  if (!this.isNew && this.isModified('slug')) {
    const existing = await College.findById(this._id).select('slug').lean();
    if (existing && existing.slug && existing.slug !== this.slug) {
      const err = new Error('College slug is immutable once established and cannot be changed.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!this.slug && this.name) {
    let baseSlug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug || isSlugReserved(baseSlug) || baseSlug.length < 3) {
      baseSlug = `college-${baseSlug || 'inst'}`;
    }

    let candidateSlug = baseSlug;
    let counter = 1;
    while (
      isSlugReserved(candidateSlug) ||
      (await College.exists({
        $or: [{ slug: candidateSlug }, { formerSlugs: candidateSlug }],
        _id: { $ne: this._id },
      }))
    ) {
      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    this.slug = candidateSlug;
  }

  if (['suspended', 'archived'].includes(this.status)) {
    this.isActive = false;
  } else if (this.status === 'active' && this.isModified('status')) {
    this.isActive = true;
  }

  if (this.createdVia && !this.creationPath) {
    this.creationPath = this.createdVia;
  } else if (this.creationPath && !this.createdVia) {
    this.createdVia = this.creationPath;
  }
});

// Synchronize status/isActive and block immutable slug mutations on query updates
collegeSchema.pre(['updateOne', 'findOneAndUpdate', 'findByIdAndUpdate'], function () {
  const update = this.getUpdate();
  if (update) {
    const attemptedSlug = update.slug || (update.$set && update.$set.slug);
    if (attemptedSlug !== undefined) {
      const err = new Error('College slug is immutable and cannot be modified.');
      err.statusCode = 400;
      throw err;
    }

    const status = update.status || (update.$set && update.$set.status);
    if (['suspended', 'archived'].includes(status)) {
      if (update.$set) {
        update.$set.isActive = false;
      } else {
        update.isActive = false;
      }
    } else if (status === 'active') {
      if (update.$set) {
        update.$set.isActive = true;
      } else {
        update.isActive = true;
      }
    }
  }
});

// Text search index for full-text search across tenant names and codes
collegeSchema.index({ name: 'text', code: 'text' });

// Compound indexes for directory filtering and sorting
collegeSchema.index({ status: 1, createdAt: -1 });
collegeSchema.index({ status: 1, subscriptionPlan: 1 });

module.exports = mongoose.model('College', collegeSchema);
