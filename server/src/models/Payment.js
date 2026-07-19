const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fine',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['razorpay', 'stripe'],
      default: 'razorpay',
    },
    providerSessionId: {
      type: String,
    },
    providerEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'completed'],
      default: 'completed',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
