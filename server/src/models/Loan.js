const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
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
  issueDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  returnDate: {
    type: Date,
  },
  renewCount: {
    type: Number,
    default: 0,
  },
  maxRenewals: {
    type: Number,
    default: 2,
  },
  status: {
    type: String,
    enum: ['active', 'returned', 'overdue'],
    default: 'active',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Loan', loanSchema);
