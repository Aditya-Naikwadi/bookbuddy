const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * Centralized Audit Logging Utility
 * Non-blocking, fault-tolerant write path for control-plane and security mutations.
 */
const logAuditEvent = async ({
  actorId,
  actorRole = 'system',
  action,
  targetType = 'System',
  targetId = null,
  collegeId = null,
  severity = 'info',
  metadata = {},
  req = null,
}) => {
  try {
    const ipAddress = req
      ? req.ip || (req.headers && req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress)
      : undefined;

    await AuditLog.create({
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      collegeId,
      severity,
      metadata,
      ipAddress,
    });
  } catch (err) {
    logger.error(`AUDIT LOG WRITE FAILURE: ${err.message}`, { action, actorId, severity });
  }
};

module.exports = {
  logAuditEvent,
};
