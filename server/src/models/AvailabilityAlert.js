// Schema representing patron "Notify Me" stock/availability alerts.
// Rule: Define each field's indexing EITHER inline via schema options OR via explicit schema.index() calls, never both for the same field/combination.
const mongoose = require('mongoose');

const availabilityAlertSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resourceType: {
      type: String,
      enum: ['book', 'eresource'],
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'notified', 'cancelled', 'expired'],
      default: 'active',
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
availabilityAlertSchema.index({ collegeId: 1, resourceType: 1, resourceId: 1, status: 1 });
availabilityAlertSchema.index({ userId: 1, status: 1 });
availabilityAlertSchema.index({ collegeId: 1, userId: 1, resourceId: 1 }, { unique: true });

module.exports = mongoose.model('AvailabilityAlert', availabilityAlertSchema);
