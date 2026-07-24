const logger = require('../utils/logger');

/**
 * Deprecation warning middleware for unversioned legacy API paths.
 */
const deprecationWarning = (req, res, next) => {
  res.setHeader('X-Deprecated-Path', 'true');
  res.setHeader(
    'X-Deprecation-Warning',
    'This unversioned API endpoint is deprecated and will be removed in 90 days. Please migrate to the /api/v1/ prefix.'
  );
  logger.warn(
    `[Deprecation Warning] Deprecated path hit: ${req.originalUrl}. Migration required to /api/v1 prefix.`
  );
  next();
};

module.exports = deprecationWarning;
