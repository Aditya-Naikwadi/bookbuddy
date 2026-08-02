const AuditLog = require('../models/AuditLog');

/**
 * Reusable middleware factory for admin action auditing.
 * It intercept mutations, checks response status, and sanitizes/logs metadata.
 */
const auditLog = (actionName) => {
  return (req, res, next) => {
    res.on('finish', async () => {
      // Only log successful completions
      if (res.statusCode >= 200 && res.statusCode < 400 && req.user) {
        try {
          const { targetType, targetId, metadata, collegeId } = res.locals.auditMeta || {};

          // Clean metadata to strictly sanitize passwords or token hashes
          let cleanedMetadata = {};
          if (metadata) {
            cleanedMetadata = { ...metadata };
            // Ensure no credentials or tokens are logged
            const blacklistedKeys = [
              'password',
              'passwordHash',
              'refreshToken',
              'refreshTokenHash',
              'token',
            ];
            blacklistedKeys.forEach((key) => {
              if (key in cleanedMetadata) {
                delete cleanedMetadata[key];
              }
            });
          }

          // Write to DB
          await AuditLog.create({
            actorId: req.user.id || req.user._id,
            actorRole: req.user.role,
            action: actionName,
            targetType,
            targetId,
            collegeId: collegeId || req.user.collegeId || undefined,
            metadata: cleanedMetadata,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          });
        } catch (err) {
          // Log errors to process stdout/logs, do not interrupt request flow
          // eslint-disable-next-line no-console
          console.error(`Audit logging failed for action ${actionName}:`, err);
        }
      }
    });
    next();
  };
};

module.exports = auditLog;
