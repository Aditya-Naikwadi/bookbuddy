const mongoose = require('mongoose');

const labBookingSchema = new mongoose.Schema(
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
    seatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabSeat',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['booked', 'cancelled', 'completed', 'no_show'],
      default: 'booked',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index optimized for query paths
labBookingSchema.index({ seatId: 1, date: 1, status: 1 });

// Concurrency control: partial unique index so that a timeslot can only be booked by one person at a time
labBookingSchema.index(
  { seatId: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: 'booked' } }
);

module.exports = mongoose.model('LabBooking', labBookingSchema);
