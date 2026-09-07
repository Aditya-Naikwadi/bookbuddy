const mongoose = require('mongoose');

const revokedTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
    reason: {
      type: String,
      default: 'Impersonation revocation or session logout',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.RevokedToken || mongoose.model('RevokedToken', revokedTokenSchema);
