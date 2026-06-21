const mongoose = require('mongoose');

const streakRewardSchema = new mongoose.Schema({
  streakDays: {
    type: Number,
    required: true,
    unique: true
  },
  rewardType: {
    type: String,
    required: true // e.g., 'visual_upgrade', 'freeze', 'bonus_renewal', 'patron_theme', 'certificate', 'early_access', 'title_badge', 'perk'
  },
  rewardPayload: {
    type: mongoose.Schema.Types.Mixed, // flexible payload for distinct rewards
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('StreakReward', streakRewardSchema);
