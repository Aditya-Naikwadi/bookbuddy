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
    resourceType: {
      type: String,
      enum: ['workstation', 'quiet_seat', 'study_pod'],
      default: 'workstation',
      index: true,
    },
    status: {
      type: String,
      enum: ['booked', 'soft_locked', 'cancelled', 'completed', 'no_show'],
      default: 'booked',
      index: true,
    },
    softLockExpiresAt: {
      type: Date,
      default: null,
    },
    confirmationToken: {
      type: String,
      default: null,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index optimized for query paths
labBookingSchema.index({ seatId: 1, date: 1, status: 1 });
labBookingSchema.index({ userId: 1, date: 1, status: 1 });
labBookingSchema.index({ userId: 1, status: 1, startTime: 1, endTime: 1 });
labBookingSchema.index({ collegeId: 1, userId: 1, status: 1, updatedAt: -1 });

// Concurrency control: partial unique index so that a seat at a date/timeslot can only be booked by one patron
labBookingSchema.index(
  { seatId: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: 'booked' } }
);
labBookingSchema.index(
  { seatId: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: 'booked' } }
);

module.exports = mongoose.model('LabBooking', labBookingSchema);
