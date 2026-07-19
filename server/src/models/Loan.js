// Schema representing book borrowing transactions.
const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
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
    issueDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    returnDate: {
      type: Date,
      default: null,
    },
    renewalCount: {
      type: Number,
      default: 0,
      required: true,
    },
    maxRenewals: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'returned', 'overdue'],
      default: 'active',
      index: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
loanSchema.index({ collegeId: 1, status: 1 });
loanSchema.index({ userId: 1, status: 1 });
loanSchema.index({ userId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Loan', loanSchema);
