// Schema representing book hold reservations.
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
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
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'ready_for_pickup', 'fulfilled', 'cancelled', 'expired'],
      default: 'queued',
      index: true,
    },
    queuePosition: {
      type: Number,
      required: true,
    },
    readyAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
reservationSchema.index({ bookId: 1, status: 1 });
reservationSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
