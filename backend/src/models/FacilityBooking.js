const mongoose = require('mongoose');

const facilityBookingSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: [true, 'College ID is required'],
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacilityResource',
      required: [true, 'Resource ID is required'],
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Booking date is required'],
      index: true,
    },
    slotStart: {
      type: Date,
      required: [true, 'Slot start time is required'],
      index: true,
    },
    slotEnd: {
      type: Date,
      required: [true, 'Slot end time is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['held', 'confirmed', 'checked-in', 'completed', 'no-show', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledWithinGrace: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL UNIQUE PARTIAL INDEX: Structurally prevents timeslot double-booking at the database engine tier
facilityBookingSchema.index(
  { resourceId: 1, date: 1, slotStart: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['confirmed', 'checked-in'] } },
  }
);

facilityBookingSchema.index({ collegeId: 1, studentId: 1, status: 1, slotStart: -1 });
facilityBookingSchema.index({ collegeId: 1, status: 1, slotStart: 1 });

module.exports = mongoose.model('FacilityBooking', facilityBookingSchema);
