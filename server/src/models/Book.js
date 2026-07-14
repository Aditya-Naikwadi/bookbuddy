// Schema representing physical and digital book assets in the catalog.
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    isbn: {
      type: String,
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
    category: {
      type: String,
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ['physical', 'digital'],
      default: 'physical',
    },
    copiesTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    copiesAvailable: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    shelfLocation: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index
bookSchema.index({ collegeId: 1, category: 1 });

// Text index for search
bookSchema.index({ title: 'text', author: 'text' });

module.exports = mongoose.model('Book', bookSchema);
