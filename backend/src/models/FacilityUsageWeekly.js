const mongoose = require('mongoose');

const facilityUsageWeeklySchema = new mongoose.Schema(
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
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true,
    },
    resourceType: {
      type: String,
      enum: ['seat', 'workstation'],
      required: [true, 'Resource type is required'],
      index: true,
    },
    weekStart: {
      type: Date,
      required: [true, 'Week start date is required'],
      index: true,
    },
    minutesUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

facilityUsageWeeklySchema.index(
  { collegeId: 1, studentId: 1, resourceType: 1, weekStart: 1 },
  { unique: true }
);

module.exports = mongoose.model('FacilityUsageWeekly', facilityUsageWeeklySchema);
