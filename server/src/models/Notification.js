const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['due_reminder', 'overdue_fine', 'hold_ready', 'general_alert', 'complaint_update'],
    default: 'general_alert',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  actionUrl: {
    type: String,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Notification', notificationSchema);
