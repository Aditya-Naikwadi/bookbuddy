const mongoose = require('mongoose');

const facilityResourceSchema = new mongoose.Schema(
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
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacilityResourceGroup',
      required: [true, 'Group ID is required'],
      index: true,
    },
    label: {
      type: String,
      required: [true, 'Resource label is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['available', 'maintenance', 'institutional-block'],
      default: 'available',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

facilityResourceSchema.index({ collegeId: 1, groupId: 1, label: 1 }, { unique: true });

module.exports = mongoose.model('FacilityResource', facilityResourceSchema);
