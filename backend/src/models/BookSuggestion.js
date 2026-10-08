const mongoose = require('mongoose');

const bookSuggestionSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'acquired'],
      default: 'pending',
      index: true,
    },
    adminNote: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const { sanitizeHtmlString } = require('../utils/sanitize');

bookSuggestionSchema.pre('save', function () {
  if (this.title) this.title = sanitizeHtmlString(this.title);
  if (this.author) this.author = sanitizeHtmlString(this.author);
  if (this.reason) this.reason = sanitizeHtmlString(this.reason);
  if (this.adminNote) this.adminNote = sanitizeHtmlString(this.adminNote);
});

module.exports = mongoose.model('BookSuggestion', bookSuggestionSchema);
