const mongoose = require('mongoose');

const facilityBookingQueueSchema = new mongoose.Schema(
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
    resourceGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacilityResourceGroup',
      required: [true, 'Resource Group ID is required'],
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacilityResource',
      default: null,
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
      required: [true, 'Slot date is required'],
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
    },
    queuePosition: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'ready_to_confirm', 'confirmed', 'expired', 'cancelled'],
      default: 'queued',
      index: true,
    },
    promotedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique position index per resource group, date, and slotStart for queued records
facilityBookingQueueSchema.index(
  { resourceGroupId: 1, date: 1, slotStart: 1, queuePosition: 1 },
  { unique: true, partialFilterExpression: { status: 'queued' } }
);

// Prevent a student from joining the queue multiple times for the same slot
facilityBookingQueueSchema.index(
  { studentId: 1, resourceGroupId: 1, date: 1, slotStart: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['queued', 'ready_to_confirm'] } } }
);

facilityBookingQueueSchema.index({ collegeId: 1, studentId: 1, status: 1 });
facilityBookingQueueSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('FacilityBookingQueue', facilityBookingQueueSchema);
