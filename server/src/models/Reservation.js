const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'ready_for_pickup', 'completed', 'cancelled'],
    default: 'pending',
  },
  queuePosition: {
    type: Number,
    required: true,
  },
  notifiedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Reservation', reservationSchema);
