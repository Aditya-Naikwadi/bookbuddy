const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
    },
    criteria: {
      type: Object,
      default: {},
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Badge', badgeSchema);
