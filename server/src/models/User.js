const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: function () {
        return !['google', 'github'].includes(this.authProvider);
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
      required: function () {
        return this.role !== 'super-admin';
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
    role: {
      type: String,
      enum: ['student', 'college-admin', 'super-admin', 'general'],
      default: 'student',
    },
    membershipStatus: {
      type: String,
      enum: ['active', 'suspended', 'expired'],
      default: 'active',
    },
    status: {
      type: String,
      enum: ['invited', 'active', 'disabled'],
      default: 'active',
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
        date.setFullYear(date.getFullYear() + 4); // Default 4 years validity
        return date;
      },
    },
    major: {
      type: String,
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
    permissions: [
      {
        type: String,
        trim: true,
      },
    ],
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

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Compound unique indexes scoped to collegeId
userSchema.index({ collegeId: 1, studentId: 1 }, { unique: true, sparse: true });
userSchema.index({ collegeId: 1, email: 1 }, { unique: true, sparse: true });

// Super Admin Directory & Query Optimization Indexes
userSchema.index({ role: 1, collegeId: 1, status: 1 });
userSchema.index({ name: 'text', email: 'text' });

// Hash password and generate cardSecret before saving
userSchema.pre('save', async function () {
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
