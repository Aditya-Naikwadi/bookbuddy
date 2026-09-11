const mongoose = require('mongoose');

const facilityResourceGroupSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: [true, 'College ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Resource group name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['seat', 'workstation'],
      required: [true, 'Resource type is required'],
      index: true,
    },
    slotDurationMinutes: {
      type: Number,
      default: 60,
      min: 15,
      max: 480,
    },
    operatingHours: {
      openTime: {
        type: String,
        default: '08:00',
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
      closeTime: {
        type: String,
        default: '22:00',
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    bookingHorizon: {
      type: String,
      enum: ['shortLead1hr', 'dayAhead1day'],
      default: function () {
        return this.type === 'workstation' ? 'shortLead1hr' : 'dayAhead1day';
      },
    },
    totalUnits: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

facilityResourceGroupSchema.index({ collegeId: 1, name: 1 });

module.exports = mongoose.model('FacilityResourceGroup', facilityResourceGroupSchema);
