const mongoose = require('mongoose');

const streakSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastQualifyingDate: {
    type: String, // Stored as 'YYYY-MM-DD' in user's local timezone
    default: null
  },
  freezesAvailable: {
    type: Number,
    default: 0,
    max: 2
  },
  freezesUsedTotal: {
    type: Number,
    default: 0
  },
  repairUsedThisMonth: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Streak', streakSchema);
