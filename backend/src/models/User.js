const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const {
  normalizeEmail,
  normalizeStudentId,
  normalizeRole,
  ROLES,
  CANONICAL_ROLES,
} = require('@bookbuddy/shared');

const userSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: function () {
        return this.role === 'student' || this.role === 'college-student';
      },
      trim: true,
      lowercase: true,
      set: normalizeStudentId,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      set: normalizeEmail,
    },
    program: {
      type: String,
      trim: true,
    },
    year: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    activationTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    activationTokenExpiresAt: {
      type: Date,
      default: null,
    },
    uploadBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentUploadBatch',
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
    password: {
      type: String,
      required: function () {
        return !['google', 'github'].includes(this.authProvider) && !this.activationTokenHash;
      },
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    githubId: {
      type: String,
      sparse: true,
      unique: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'github'],
      default: 'local',
    },
    avatar: {
      type: String,
      default: '',
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      default: null,
      required: function () {
        return this.role === 'college-student';
      },
      index: true,
    },
    cardSecret: {
      type: String,
      select: false,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    hasSeenOnboarding: {
      type: Boolean,
      default: false,
    },
    mustChangePasswordOnNextLogin: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: CANONICAL_ROLES,
      default: ROLES.STUDENT,
      set: normalizeRole,
    },
    membershipStatus: {
      type: String,
      enum: ['active', 'suspended', 'expired'],
      default: 'active',
    },
    status: {
      type: String,
      enum: ['invited', 'active', 'inactive', 'disabled'],
      default: 'active',
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivationReason: {
      type: String,
      default: null,
    },
    invitedVia: {
      type: String,
      enum: ['self_registration', 'bulk_upload'],
      default: 'self_registration',
    },
    invitationToken: {
      type: String,
      default: null,
      select: false,
    },
    validTill: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 4);
        return date;
      },
    },
    major: {
      type: String,
    },
    department: {
      type: String,
      trim: true,
    },
    savedBookmarks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
      },
    ],
    searchHistory: [
      {
        query: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    mfaSecret: {
      type: String,
      select: false,
    },
    isMfaEnabled: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    impersonatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    subRole: {
      type: String,
      enum: ['root_admin', 'support_agent', 'content_moderator', 'security_auditor'],
      default: 'root_admin',
    },
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: () => [
        'canManageAcquisitions',
        'canViewAnalytics',
        'canManagePatrons',
        'canManageCirculation',
        'canManageCatalog',
      ],
    },
    points: {
      type: Number,
      default: 0,
      index: true,
    },
    isLeaderboardVisible: {
      type: Boolean,
      default: true,
    },
    fineWaiverCoupons: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual Aliases for Blueprint Spec Compatibility
userSchema
  .virtual('fullName')
  .get(function () {
    return this.name;
  })
  .set(function (v) {
    this.name = v;
  });

userSchema
  .virtual('isTwoFactorEnabled')
  .get(function () {
    return this.isMfaEnabled;
  })
  .set(function (v) {
    this.isMfaEnabled = v;
  });

userSchema
  .virtual('twoFactorSecret')
  .get(function () {
    return this.mfaSecret;
  })
  .set(function (v) {
    this.mfaSecret = v;
  });

userSchema
  .virtual('isLeaderboardPublic')
  .get(function () {
    return this.isLeaderboardVisible;
  })
  .set(function (v) {
    this.isLeaderboardVisible = v;
  });

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Compound unique indexes scoped to collegeId
userSchema.index({ collegeId: 1, studentId: 1 }, { unique: true, sparse: true });
userSchema.index(
  { collegeId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: 'string' },
    },
  }
);
userSchema.index({ activationTokenHash: 1 }, { sparse: true });
userSchema.index({ collegeId: 1, status: 1 });
userSchema.index({ collegeId: 1, role: 1, createdAt: -1 });
userSchema.index({ collegeId: 1, role: 1, department: 1, createdAt: -1 });
userSchema.index({ collegeId: 1, role: 1, studentId: 1 });
userSchema.index({ status: 1, createdAt: -1 });

// Super Admin Directory & Query Optimization Indexes
userSchema.index({ role: 1, collegeId: 1, status: 1 });
userSchema.index({ name: 'text', email: 'text', studentId: 'text' });

// Normalize fields, hash password and generate cardSecret before saving
userSchema.pre('save', async function () {
  if (this.studentId) {
    this.studentId = normalizeStudentId(this.studentId);
  }
  if (this.email) {
    this.email = normalizeEmail(this.email) || undefined;
  } else {
    this.email = undefined;
  }
  if (this.role) {
    this.role = normalizeRole(this.role);
  }
  if (['inactive', 'disabled'].includes(this.status)) {
    this.isActive = false;
  } else if (this.status === 'active' && this.isModified('status')) {
    this.isActive = true;
  }
  if (this.department && !this.major) {
    this.major = this.department;
  } else if (this.major && !this.department) {
    this.department = this.major;
  }
  if (this.collegeId === undefined) {
    this.collegeId = null;
  }
  if (!this.cardSecret) {
    const crypto = require('crypto');
    this.cardSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!this.isModified('password')) return;

  // Don't re-hash if already hashed with Argon2id or Bcrypt
  if (
    typeof this.password === 'string' &&
    (this.password.startsWith('$argon2') || /^\$2[aby]\$\d{2}\$/.test(this.password))
  ) {
    return;
  }

  const argon2 = require('argon2');
  this.password = await argon2.hash(this.password, { type: argon2.argon2id });
});

// Normalization enforcement on update queries across all update paths
userSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'findByIdAndUpdate'], function () {
  const update = this.getUpdate();
  if (!update) return;

  const normalizeUpdateTarget = (target) => {
    if (!target) return;
    if (target.email !== undefined) {
      target.email = normalizeEmail(target.email) || undefined;
    }
    if (target.studentId !== undefined) {
      target.studentId = normalizeStudentId(target.studentId);
    }
    if (target.role !== undefined) {
      target.role = normalizeRole(target.role);
    }
    if (target.status !== undefined) {
      if (['inactive', 'disabled'].includes(target.status)) {
        target.isActive = false;
      } else if (target.status === 'active') {
        target.isActive = true;
      }
    }
  };

  normalizeUpdateTarget(update);
  if (update.$set) normalizeUpdateTarget(update.$set);
  if (update.$setOnInsert) normalizeUpdateTarget(update.$setOnInsert);
});

// Compare password supporting Argon2id and transparent bcrypt upgrade
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;

  if (this.password.startsWith('$argon2')) {
    const argon2 = require('argon2');
    return await argon2.verify(this.password, candidatePassword);
  }

  if (/^\$2[aby]\$\d{2}\$/.test(this.password)) {
    const isBcryptMatch = await bcrypt.compare(candidatePassword, this.password);
    if (isBcryptMatch) {
      // Seamlessly upgrade legacy bcrypt hash to Argon2id
      try {
        const argon2 = require('argon2');
        this.password = await argon2.hash(candidatePassword, { type: argon2.argon2id });
        await this.save();
      } catch {
        // Fallback gracefully if auto-upgrade fails
      }
    }
    return isBcryptMatch;
  }

  return false;
};

module.exports = mongoose.model('User', userSchema);
