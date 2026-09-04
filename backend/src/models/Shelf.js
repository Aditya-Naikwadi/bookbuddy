const mongoose = require('mongoose');

const shelfSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    books: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index: A user cannot have two shelves with the exact same name within their college
shelfSchema.index({ collegeId: 1, userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Shelf', shelfSchema);
