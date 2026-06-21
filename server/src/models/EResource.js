const mongoose = require('mongoose');

const eResourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['Past Exam Papers', 'Research Journals', 'Faculty Publications', 'Open Access', 'Public Domain', 'Textbook'],
    required: true,
  },
  type: {
    type: String, // PDF, EPUB, HTML etc.
    default: 'PDF'
  },
  sizeMB: {
    type: Number,
  },
  url: {
    type: String, // Kept for backward compatibility with internal resources
  },
  source: { 
    type: String, 
    enum: ['internal', 'gutenberg'], 
    default: 'internal' 
  },
  externalId: { 
    type: Number, 
    default: null 
  }, // Gutendex book id when source = 'gutenberg'
  readUrl: {
    type: String
  },
  epubUrl: {
    type: String
  },
  downloadCount: {
    type: Number
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  accessLevel: {
    type: String,
    enum: ['public', 'student', 'faculty'],
    default: 'student',
  },
  status: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected'],
    default: 'pending_review',
  }
}, {
  timestamps: true,
});

// Sparse unique index to prevent duplicate Gutendex imports
eResourceSchema.index({ source: 1, externalId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('EResource', eResourceSchema);
