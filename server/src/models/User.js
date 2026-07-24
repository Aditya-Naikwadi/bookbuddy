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
      required: true,
      select: false,
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
  },
  {
    timestamps: true,
  }
);

// Compound unique indexes scoped to collegeId
userSchema.index({ collegeId: 1, studentId: 1 }, { unique: true, sparse: true });
userSchema.index({ collegeId: 1, email: 1 }, { unique: true, sparse: true });

// Hash password and generate cardSecret before saving
userSchema.pre('save', async function () {
  if (!this.cardSecret) {
    const crypto = require('crypto');
    this.cardSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!this.isModified('password')) return;
  if (typeof this.password === 'string' && /^\$2[aby]\$\d{2}\$/.test(this.password)) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
