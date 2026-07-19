const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false, // Security: Never leak push tokens in default queries
    },
    platform: {
      type: String,
      enum: ['web', 'ios', 'android'],
      required: true,
      default: 'web',
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast user device notification fanout
deviceTokenSchema.index({ userId: 1, lastSeenAt: -1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
