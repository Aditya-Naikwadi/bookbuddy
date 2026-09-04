const mongoose = require('mongoose');

const streakRewardSchema = new mongoose.Schema(
  {
    milestoneThreshold: {
      type: Number,
      required: true,
      unique: true,
    },
    rewardType: {
      type: String,
      enum: ['theme', 'freeze', 'badge'],
      required: true,
    },
    rewardValue: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StreakReward', streakRewardSchema);
