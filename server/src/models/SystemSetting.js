const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    globalMaxBorrowLimit: {
      type: Number,
      default: 5,
    },
    defaultFinePerDay: {
      type: Number,
      default: 2,
    },
    backupSchedule: {
      type: String,
      default: '0 3 * * *',
    },
    featureFlags: {
      type: Map,
      of: Boolean,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

systemSettingSchema.set('toJSON', { virtuals: true });
systemSettingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
