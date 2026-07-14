// Schema representing overdue loan fines.
const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema(
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
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
      index: true,
    },
    overdueDays: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['unpaid', 'paid', 'waived'],
      default: 'unpaid',
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
fineSchema.index({ userId: 1, status: 1 });
fineSchema.index({ collegeId: 1, status: 1 });
fineSchema.index(
  { loanId: 1 },
  { unique: true, partialFilterExpression: { status: 'unpaid' } }
);

module.exports = mongoose.model('Fine', fineSchema);
