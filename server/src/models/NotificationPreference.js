const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  emailAlerts: {
    type: Boolean,
    default: true,
  },
  smsAlerts: {
    type: Boolean,
    default: false,
  },
  pushAlerts: {
    type: Boolean,
    default: true,
  },
  notifyOnDue: {
    type: Boolean,
    default: true,
  },
  notifyOnHoldReady: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
