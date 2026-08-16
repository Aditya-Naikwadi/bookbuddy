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

          // Anti-falsification: If action is taken while impersonating, actorId MUST be the original super admin ID
          const actorId =
            req.user.isImpersonated && req.user.originalSuperAdminId
              ? req.user.originalSuperAdminId
              : req.user.id || req.user._id;

          if (req.user.isImpersonated) {
            cleanedMetadata.isImpersonated = true;
            cleanedMetadata.impersonatedUserId = req.user.id || req.user._id;
          }

          // Write to DB
          const createdLog = await AuditLog.create({
            actorId,
            actorRole: req.user.isImpersonated ? 'super-admin' : req.user.role,
            action: actionName,
            targetType,
            targetId,
            collegeId: collegeId || req.user.collegeId || undefined,
            metadata: cleanedMetadata,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          });

          // Optional SIEM Webhook Export (Opt-In Integration)
          if (process.env.SIEM_WEBHOOK_URL) {
            try {
              const http = require('http');
              const https = require('https');
              const url = new URL(process.env.SIEM_WEBHOOK_URL);
              const transport = url.protocol === 'https:' ? https : http;
              const payloadData = JSON.stringify(
                createdLog.toObject ? createdLog.toObject() : createdLog
              );

              const siemReq = transport.request(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payloadData),
                },
              });
              siemReq.on('error', () => {}); // Silent failure for external SIEM errors
              siemReq.write(payloadData);
              siemReq.end();
            } catch {
              // Ignore SIEM export network errors
            }
          }
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
