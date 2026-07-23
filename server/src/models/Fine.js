// Schema representing overdue loan fines.
// Rule: Define each field's indexing EITHER inline via schema options OR via explicit schema.index() calls, never both for the same field/combination.
const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
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
fineSchema.index({ loanId: 1 }, { unique: true, partialFilterExpression: { status: 'unpaid' } });

module.exports = mongoose.model('Fine', fineSchema);
