const mongoose = require('mongoose');

const bookRequestSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    isbn: {
      type: String,
      default: '',
      trim: true,
    },
    reason: {
      type: String,
      default: '',
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'fulfilled'],
      default: 'pending',
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

bookRequestSchema.index({ collegeId: 1, userId: 1, status: 1 });
bookRequestSchema.index({ collegeId: 1, title: 1, author: 1 });

module.exports = mongoose.model('BookRequest', bookRequestSchema);
