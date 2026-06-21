const mongoose = require('mongoose');

const labSeatSchema = new mongoose.Schema({
  seatNumber: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['available', 'maintenance', 'reserved'],
    default: 'available',
  },
  computerSpecs: {
    type: String, // e.g., "i7, 16GB RAM, RTX 3060"
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('LabSeat', labSeatSchema);
