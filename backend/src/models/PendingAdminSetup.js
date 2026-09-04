const mongoose = require('mongoose');

/**
 * PendingAdminSetup Schema
 * Stores hashed time-limited setup tokens for emailed primary college admin onboarding.
 */
const pendingAdminSetupSchema = new mongoose.Schema(
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
    },
    hashedSetupToken: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumed: {
      type: Boolean,
      default: false,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Look up active setup token by hashed string value
pendingAdminSetupSchema.index({ hashedSetupToken: 1, consumed: 1 });

// TTL Auto-Expiry index (removes expired setup tokens after 48 hours)
pendingAdminSetupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingAdminSetup', pendingAdminSetupSchema);
