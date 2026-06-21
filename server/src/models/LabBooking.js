const mongoose = require('mongoose');

const labBookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  seatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabSeat',
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
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('LabBooking', labBookingSchema);
