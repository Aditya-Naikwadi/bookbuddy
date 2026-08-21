const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    fineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fine',
      index: true,
    },
    fineIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fine',
      },
    ],
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    gatewayOrderId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
    gatewayPaymentId: {
      type: String,
      default: null,
    },
    providerEventId: {
      type: String,
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed'],
      default: 'created',
    },
    webhookVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
