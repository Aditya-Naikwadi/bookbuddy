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
    },
    actor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      role: {
        type: String,
      },
      email: {
        type: String,
      },
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      index: true,
    },
    targetType: {
      type: String,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    target: {
      targetType: {
        type: String,
      },
      targetId: {
        type: mongoose.Schema.Types.ObjectId,
      },
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
      enum: ['routine', 'security', 'info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Synchronization hook for actor, target, and action/actionType fields
auditLogSchema.pre(['save', 'validate'], function (next) {
  if (!this.isNew) {
    const err = new Error('Audit log entries are immutable and cannot be updated.');
    if (typeof next === 'function') return next(err);
    throw err;
  }

  if (this.action && !this.actionType) {
    this.actionType = this.action;
  } else if (this.actionType && !this.action) {
    this.action = this.actionType;
  }

  if (this.actorId && (!this.actor || !this.actor.userId)) {
    this.actor = this.actor || {};
    this.actor.userId = this.actorId;
    if (this.actorRole && !this.actor.role) this.actor.role = this.actorRole;
  } else if (this.actor && this.actor.userId) {
    this.actorId = this.actor.userId;
    if (this.actor.role) this.actorRole = this.actor.role;
  }

  if (this.targetId && (!this.target || !this.target.targetId)) {
    this.target = this.target || {};
    this.target.targetId = this.targetId;
    if (this.targetType && !this.target.targetType) this.target.targetType = this.targetType;
  } else if (this.target && this.target.targetId) {
    this.targetId = this.target.targetId;
    if (this.target.targetType) this.targetType = this.target.targetType;
  }

  if (typeof next === 'function') {
    next();
  }
});

// Hardened Immutability: Block update/delete queries at schema middleware layer
const blockMutation = function (next) {
  return next(
    new Error(
      'FATAL: Database update/delete operations are strictly forbidden on AuditLog collection.'
    )
  );
};

auditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany'],
  blockMutation
);

/* -------------------------------------------------------------------------- */
/*                                INDEXES                                     */
/* -------------------------------------------------------------------------- */

// Legacy & Root Level Indexes
auditLogSchema.index({ actorRole: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });

// Super Admin & Security Operations Compound Indexes
auditLogSchema.index({ 'actor.userId': 1, createdAt: -1 });
auditLogSchema.index({ actionType: 1, createdAt: -1 });
auditLogSchema.index({ 'target.targetId': 1, createdAt: -1 });
auditLogSchema.index({ collegeId: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, actionType: 1, createdAt: -1 });

// Institutional Compliance Retention: 365 days TTL
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
if (!mongoose.models.AuditLogEntry) {
  mongoose.model('AuditLogEntry', auditLogSchema);
}

module.exports = AuditLog;
