const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    resolutionMessage: {
      type: String,
      default: '',
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    lastAdminReplyAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

complaintSchema.index({ collegeId: 1, status: 1, createdAt: -1 });

const { sanitizeHtmlString } = require('../utils/sanitize');

complaintSchema.pre('save', function () {
  if (this.subject) this.subject = sanitizeHtmlString(this.subject);
  if (this.description) this.description = sanitizeHtmlString(this.description);
  if (this.resolutionMessage) this.resolutionMessage = sanitizeHtmlString(this.resolutionMessage);
});

complaintSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (update) {
    if (update.subject) update.subject = sanitizeHtmlString(update.subject);
    if (update.description) update.description = sanitizeHtmlString(update.description);
    if (update.resolutionMessage)
      update.resolutionMessage = sanitizeHtmlString(update.resolutionMessage);
    if (update.$set) {
      if (update.$set.subject) update.$set.subject = sanitizeHtmlString(update.$set.subject);
      if (update.$set.description)
        update.$set.description = sanitizeHtmlString(update.$set.description);
      if (update.$set.resolutionMessage)
        update.$set.resolutionMessage = sanitizeHtmlString(update.$set.resolutionMessage);
    }
  }
});

const { tenantScopingPlugin } = require('../middlewares/scopeToCollege');
complaintSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Complaint', complaintSchema);
