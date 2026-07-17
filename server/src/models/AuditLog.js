const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
