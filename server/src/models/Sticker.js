const mongoose = require('mongoose');

const stickerSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['streak_milestone', 'exploration', 'seasonal'],
    required: true
  },
  criteriaType: {
    type: String,
    enum: ['streak_days', 'genre_count', 'eresource_count', 'lab_count', 'feedback_count'],
    required: true
  },
  criteriaValue: {
    type: Number,
    required: true
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Sticker', stickerSchema);
