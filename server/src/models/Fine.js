const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: true,
  },
  ratePerDay: {
    type: Number,
    required: true,
    default: 5, // e.g., ₹5/day
  },
  daysOverdue: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['unpaid', 'paid', 'waived'],
    default: 'unpaid',
  },
  paidAt: {
    type: Date,
  },
  paymentRef: {
    type: String,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Fine', fineSchema);
