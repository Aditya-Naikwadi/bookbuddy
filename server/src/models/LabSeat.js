const mongoose = require('mongoose');

const labSeatSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    labName: {
      type: String,
      required: true,
    },
    seatNumber: {
      type: String,
      required: true,
    },
    specs: {
      type: String,
    },
    maintenanceStatus: {
      type: String,
      enum: ['operational', 'maintenance', 'retired'],
      default: 'operational',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: no duplicate seat identifiers within the same lab/college
labSeatSchema.index({ collegeId: 1, labName: 1, seatNumber: 1 }, { unique: true });

module.exports = mongoose.model('LabSeat', labSeatSchema);
