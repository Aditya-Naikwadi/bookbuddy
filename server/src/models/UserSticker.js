const mongoose = require('mongoose');

const userStickerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stickerCode: {
    type: String,
    required: true
  },
  earnedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// A user can only earn a specific sticker once
userStickerSchema.index({ userId: 1, stickerCode: 1 }, { unique: true });

module.exports = mongoose.model('UserSticker', userStickerSchema);
