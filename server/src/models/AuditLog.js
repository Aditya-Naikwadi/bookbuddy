const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      enum: [
        'college.create',
        'college.status_change',
        'college_admin.create',
        'college_admin.revoke',
        'circulation.checkout',
        'circulation.return',
        'fine.pay',
        'fine.waive',
        'suggestion.moderate',
        'lab_seat.create',
        'lab_seat.update',
        'complaint.resolve',
        'eresource.moderate',
        'eresource.publish',
        'announcement.create',
        'registration_request.submit',
        'registration_request.approve',
        'registration_request.reject',
        'registration_request.resubmit',
        'registration_request.verify_email',
        'registration_request.verify_domain',
      ],
    },
    targetType: {
      type: String,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent document mutations (Immutable Log Ledger)
auditLogSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Audit log entries are immutable and cannot be updated.');
  }
});

// Compound Indexes for Advanced Security Filtering:
auditLogSchema.index({ actorRole: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });

// Institutional Compliance Retention: 365 days TTL
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
