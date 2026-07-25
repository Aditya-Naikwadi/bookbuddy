// Schema representing payment transactions.
// Rule: Define each field's indexing EITHER inline via schema options OR via explicit schema.index() calls, never both for the same field/combination.
// providerEventId index is intentionally defined here AND in migration 20260724000003 — both MUST specify { unique: true, sparse: true }.
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
      sparse: true,
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
