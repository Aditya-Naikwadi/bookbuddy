const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
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
  notes: {
    type: String,
  }
}, {
  timestamps: true,
});

// Ensure a user can only bookmark a book once
bookmarkSchema.index({ userId: 1, bookId: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
