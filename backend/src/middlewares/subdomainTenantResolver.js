const College = require('../models/College');
const { isSlugReserved } = require('../constants/reservedSlugs');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { isTrustedProxy, cleanIp } = require('../utils/clientIpHelper');

/**
 * Extract candidate tenant subdomain slug from HTTP request
 */
function extractSubdomain(req) {
  // 1. Parse Host / X-Forwarded-Host header first
  const rawHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host || req?.hostname || '';
  const hostWithoutPort = rawHost.split(':')[0].trim().toLowerCase();

  let hostSubdomain = null;
  const rootDomains = ['localhost', '127.0.0.1', 'bookbuddy.com', 'bookbuddy.app', 'vercel.app'];

  if (hostWithoutPort && !rootDomains.includes(hostWithoutPort)) {
    if (hostWithoutPort.endsWith('.localhost')) {
      const parts = hostWithoutPort.split('.');
      if (parts.length === 2 && parts[0]) {
        hostSubdomain = parts[0];
      }
    } else {
      const bookBuddyMatch = hostWithoutPort.match(
        /^([a-z0-9-]+)\.bookbuddy\.(?:com|app|io|org|net)$/i
      );
      if (bookBuddyMatch && bookBuddyMatch[1]) {
        hostSubdomain = bookBuddyMatch[1].toLowerCase();
      } else {
        const parts = hostWithoutPort.split('.');
        if (parts.length >= 3 && !hostWithoutPort.endsWith('.vercel.app')) {
          hostSubdomain = parts[0].toLowerCase();
        }
      }
    }
  }

  // 2. Check explicit proxy/client header ONLY if request is from trusted local proxy
  const peerIp = cleanIp(
    req?.socket?.remoteAddress ||
      req?.connection?.remoteAddress ||
      req?.rawSocket?.remoteAddress ||
      ''
  );
  // In unit test stubs without socket or behind local Nginx (127.0.0.1 / ::1), trust is true
  const isLocalProxy = !peerIp || isTrustedProxy(peerIp);

  const rawHeader =
    req?.headers?.['x-tenant-subdomain'] ||
    req?.headers?.['x-college-subdomain'] ||
    req?.headers?.['x-college-slug'];

  const cleanHeader =
    isLocalProxy && rawHeader && typeof rawHeader === 'string'
      ? rawHeader.trim().toLowerCase()
      : null;

  // 3. Spoofed header detection: If the request arrived on an explicit host subdomain
  // but passed a conflicting tenant header, flag spoofing!
  const candidateHeader =
    rawHeader && typeof rawHeader === 'string' ? rawHeader.trim().toLowerCase() : null;
  if (hostSubdomain && candidateHeader && hostSubdomain !== candidateHeader) {
    if (req) req.subdomainSpoofDetected = true;
    return '__spoofed_subdomain__';
  }

  return hostSubdomain || cleanHeader || null;
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

    if (candidateSlug === '__spoofed_subdomain__' || req.subdomainSpoofDetected) {
      logger.warn(
        `[SPOOFED SUBDOMAIN DETECTED] Host vs Header mismatch on request from ${req.ip || 'unknown IP'}`
      );
      return next(
        new AppError(
          'Security violation: Spoofed tenant subdomain header does not match host domain.',
          403
        )
      );
    }

    // Ignore reserved tokens (e.g. api, admin, app, portal)
    if (isSlugReserved(candidateSlug)) {
      return next();
    }

    // Resolve tenant from database
    const college = await College.findOne({ slug: candidateSlug });
    if (
      !college ||
      college.status === 'suspended' ||
      college.status !== 'active' ||
      college.isActive === false
    ) {
      return res.status(404).json({
        success: false,
        message: 'Unknown college or institution',
        code: 'UNKNOWN_COLLEGE',
      });
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
