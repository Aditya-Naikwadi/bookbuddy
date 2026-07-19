const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['email', 'push'],
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
    },
    error: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to support fast user notification history list queries, unread counts, and drawer sorting
notificationLogSchema.index({ userId: 1, createdAt: -1 });
notificationLogSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
