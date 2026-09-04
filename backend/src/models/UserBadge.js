const mongoose = require('mongoose');

const userBadgeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    badgeKey: {
      type: String,
      required: true,
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique compound index so a user cannot earn the same badge twice
userBadgeSchema.index({ userId: 1, badgeKey: 1 }, { unique: true });

/**
 * Safely awards a badge to a user.
 * Attempting to award the same badge twice is a silent no-op (caught duplicate-key),
 * preventing unhandled exceptions from breaking triggering event flows.
 *
 * @param {ObjectId|string} userId
 * @param {string} badgeKey
 * @returns {Promise<{ awarded: boolean, userBadge?: object, duplicate?: boolean }>}
 */
userBadgeSchema.statics.awardBadge = async function (userId, badgeKey) {
  try {
    const userBadge = await this.create({ userId, badgeKey });
    return { awarded: true, userBadge };
  } catch (error) {
    if (error.code === 11000 || (error.name === 'MongoServerError' && error.code === 11000)) {
      // Caught duplicate-key error: return silent no-op
      return { awarded: false, duplicate: true };
    }
    throw error;
  }
};

module.exports = mongoose.model('UserBadge', userBadgeSchema);
