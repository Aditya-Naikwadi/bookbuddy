const mongoose = require('mongoose');

const smsDeliveryLogSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      index: true,
      default: null,
    },
    recipientPhoneMasked: {
      type: String,
      required: true,
      index: true,
    },
    templateId: {
      type: String,
      default: null,
      index: true,
    },
    entityId: {
      type: String,
      default: null,
    },
    header: {
      type: String,
      default: null,
    },
    messageType: {
      type: String,
      enum: ['onboarding', 'overdue_alert', 'reservation_ready', 'otp', 'general'],
      default: 'onboarding',
      index: true,
    },
    provider: {
      type: String,
      enum: ['twilio', 'msg91', 'gupshup', 'mock'],
      default: 'twilio',
      index: true,
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'delivered', 'failed'],
      default: 'queued',
      index: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    dispatchedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

smsDeliveryLogSchema.index({ collegeId: 1, dispatchedAt: -1 });
smsDeliveryLogSchema.index({ status: 1, dispatchedAt: -1 });

module.exports = mongoose.model('SMSDeliveryLog', smsDeliveryLogSchema);
