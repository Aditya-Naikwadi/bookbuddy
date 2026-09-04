const mongoose = require('mongoose');

const librarySettingsSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      unique: true,
      index: true,
    },
    openingHour: {
      type: String,
      default: '08:00',
      trim: true,
    },
    closingHour: {
      type: String,
      default: '17:00',
      trim: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    isClosedToday: {
      type: Boolean,
      default: false,
    },
    specialNotice: {
      type: String,
      default: '',
    },
    monthlyGrowthGoal: {
      type: Number,
      default: 140,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('LibrarySettings', librarySettingsSchema);
