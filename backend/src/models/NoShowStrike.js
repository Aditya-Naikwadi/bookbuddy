const mongoose = require('mongoose');

const noShowStrikeSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: [true, 'College ID is required'],
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacilityBooking',
      required: [true, 'Booking ID is required'],
      unique: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

noShowStrikeSchema.index({ collegeId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model('NoShowStrike', noShowStrikeSchema);
