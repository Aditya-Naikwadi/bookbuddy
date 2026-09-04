const mongoose = require('mongoose');

const userStickerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    stickerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sticker',
      required: true,
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userStickerSchema.index({ userId: 1, stickerId: 1 }, { unique: true });

module.exports = mongoose.model('UserSticker', userStickerSchema);
