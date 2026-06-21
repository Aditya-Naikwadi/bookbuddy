const mongoose = require('mongoose');

const readingProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  eResourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EResource',
    required: true,
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  lastReadAt: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

readingProgressSchema.index({ userId: 1, eResourceId: 1 }, { unique: true });

module.exports = mongoose.model('ReadingProgress', readingProgressSchema);
