const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
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
    required: true,
    unique: true,
  },
  category: [{
    type: String,
  }],
  tags: [{
    type: String,
  }],
  format: {
    type: String,
    enum: ['physical', 'ebook', 'audiobook'],
    default: 'physical',
  },
  language: {
    type: String,
    default: 'English',
  },
  publishedYear: {
    type: Number,
  },
  coverImage: {
    type: String,
    default: 'https://via.placeholder.com/150x200?text=No+Cover',
  },
  description: {
    type: String,
  },
  totalCopies: {
    type: Number,
    required: true,
    default: 1,
  },
  availableCopies: {
    type: Number,
    required: true,
    default: 1,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  subjects: [{
    type: String,
  }],
  location: {
    type: String, // e.g., "Aisle 3, Shelf B"
  },
  availabilityStatus: {
    type: String,
    enum: ['available', 'checked_out', 'lost', 'maintenance'],
    default: 'available',
  }
}, {
  timestamps: true,
});

// Text index for search
bookSchema.index({ title: 'text', author: 'text', isbn: 'text', category: 'text' });

module.exports = mongoose.model('Book', bookSchema);
