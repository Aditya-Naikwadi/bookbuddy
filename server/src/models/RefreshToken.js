const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false, // Security: Never leak token hashes in default queries
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
refreshTokenSchema.index({ userId: 1, expiresAt: 1 });
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
