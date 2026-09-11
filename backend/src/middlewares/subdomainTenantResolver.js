const College = require('../models/College');
const { isSlugReserved } = require('../constants/reservedSlugs');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Extract candidate tenant subdomain slug from HTTP request
 */
function extractSubdomain(req) {
  // 1. Check explicit test / proxy header
  const headerSubdomain = req.headers['x-tenant-subdomain'] || req.headers['x-college-slug'];
  if (headerSubdomain && typeof headerSubdomain === 'string') {
    return headerSubdomain.trim().toLowerCase();
  }

  // 2. Parse Host / X-Forwarded-Host header
  const rawHost = req.headers['x-forwarded-host'] || req.headers.host || req.hostname || '';
  const hostWithoutPort = rawHost.split(':')[0].trim().toLowerCase();

  if (!hostWithoutPort) return null;

  // Check against root or bare domains
  const rootDomains = ['localhost', '127.0.0.1', 'bookbuddy.com', 'bookbuddy.app', 'vercel.app'];

  if (rootDomains.includes(hostWithoutPort)) {
    return null;
  }

  // Check subdomains of localhost: e.g. "mit.localhost" -> "mit"
  if (hostWithoutPort.endsWith('.localhost')) {
    const parts = hostWithoutPort.split('.');
    if (parts.length === 2 && parts[0]) {
      return parts[0];
    }
  }

  // Check subdomains of bookbuddy: e.g. "stanford.bookbuddy.com" -> "stanford"
  const bookBuddyMatch = hostWithoutPort.match(
    /^([a-z0-9-]+)\.bookbuddy\.(?:com|app|io|org|net)$/i
  );
  if (bookBuddyMatch && bookBuddyMatch[1]) {
    return bookBuddyMatch[1].toLowerCase();
  }

  // Check general multi-part subdomain (excluding vercel preview branches e.g. xxx.vercel.app)
  const parts = hostWithoutPort.split('.');
  if (parts.length >= 3 && !hostWithoutPort.endsWith('.vercel.app')) {
    const candidate = parts[0];
    return candidate.toLowerCase();
  }

  return null;
}

/**
 * Subdomain Tenant Resolution & Cross-Tenant Boundary Middleware
 */
const subdomainTenantResolver = async (req, res, next) => {
  try {
    const candidateSlug = extractSubdomain(req);

    // If no subdomain, proceed normally (root / main portal)
    if (!candidateSlug) {
      return next();
    }

    // Ignore reserved tokens (e.g. api, admin, app, portal)
    if (isSlugReserved(candidateSlug)) {
      return next();
    }

    // Resolve tenant from database
    const college = await College.findOne({ slug: candidateSlug });
    if (!college) {
      return next(new AppError(`Institution library portal "${candidateSlug}" not found.`, 404));
    }

    if (college.status !== 'active' && college.isActive === false) {
      return next(
        new AppError(`The library portal for "${college.name}" is currently inactive.`, 403)
      );
    }

    // Attach verified subdomain tenant context to request
    req.subdomainTenant = college;
    req.subdomainCollegeId = college._id;
    req.tenantCollegeId = college._id;
    req.headers['x-college-slug'] = college.slug;
    req.headers['x-college-id'] = String(college._id);

    // --- ZERO CROSS-TENANT LEAKAGE DEFENSES ---

    // 1. Guard against payload tampering in req.body
    if (req.body && typeof req.body === 'object') {
      if (req.body.collegeId && String(req.body.collegeId) !== String(college._id)) {
        logger.warn(
          `[CROSS-TENANT VIOLATION BLOCKED] Request to subdomain ${college.slug} attempted payload collegeId ${req.body.collegeId}`
        );
        return next(
          new AppError(
            'Cross-tenant access violation: Payload collegeId does not match tenant subdomain.',
            403
          )
        );
      }
      if (req.body.collegeSlug && req.body.collegeSlug.toLowerCase() !== college.slug) {
        logger.warn(
          `[CROSS-TENANT VIOLATION BLOCKED] Request to subdomain ${college.slug} attempted payload collegeSlug ${req.body.collegeSlug}`
        );
        return next(
          new AppError(
            'Cross-tenant access violation: Payload collegeSlug does not match tenant subdomain.',
            403
          )
        );
      }
      // Force payload collegeId to subdomain tenant as string
      if (req.body.collegeId) {
        req.body.collegeId = String(college._id);
      }
    }

    // 2. Guard against query parameter tampering
    if (req.query && req.query.collegeId) {
      if (String(req.query.collegeId) !== String(college._id)) {
        logger.warn(
          `[CROSS-TENANT VIOLATION BLOCKED] Request to subdomain ${college.slug} attempted query collegeId ${req.query.collegeId}`
        );
        return next(
          new AppError(
            'Cross-tenant access violation: Query collegeId does not match tenant subdomain.',
            403
          )
        );
      }
    }

    // 3. Guard against route parameter tampering
    if (req.params && req.params.collegeId) {
      if (String(req.params.collegeId) !== String(college._id)) {
        return next(
          new AppError(
            'Cross-tenant access violation: Route college parameter does not match tenant subdomain.',
            403
          )
        );
      }
    }

    // 4. Pre-scope tenantFilter for downstream database queries
    req.tenantFilter = { collegeId: college._id };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = subdomainTenantResolver;
module.exports.extractSubdomain = extractSubdomain;
