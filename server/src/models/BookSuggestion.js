const mongoose = require('mongoose');

const bookSuggestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  author: {
    type: String,
    required: true,
  },
  isbn: {
    type: String,
  },
  reason: {
    type: String,
  },
  upvotes: {
    type: Number,
    default: 1,
  },
  upvotedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'ordered', 'rejected'],
    default: 'pending',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('BookSuggestion', bookSuggestionSchema);
