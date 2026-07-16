const mongoose = require('mongoose');

const checkInLogSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    checkInDate: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    freezeConsumed: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint to prevent concurrent double check-ins or duplicate freeze consumption on the same day
checkInLogSchema.index({ userId: 1, checkInDate: 1 }, { unique: true });
checkInLogSchema.index({ collegeId: 1, userId: 1 });

module.exports = mongoose.model('CheckInLog', checkInLogSchema);
