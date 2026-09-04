// CRITICAL: ONLY services/streakService.js is permitted to write to this collection.
// EXCEPTION: services/cronService.js is permitted to perform passive resets and freeze deductions.
const mongoose = require('mongoose');

const streakSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    lastStreakReminderSentAt: {
      type: Date,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    maxStreak: {
      type: Number,
      default: 0,
    },
    freezesAvailable: {
      type: Number,
      default: 2,
    },
    lastQualifyingActionAt: {
      type: Date,
    },
    timezone: {
      type: String,
      required: true,
      default: 'Asia/Kolkata',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Streak', streakSchema);
