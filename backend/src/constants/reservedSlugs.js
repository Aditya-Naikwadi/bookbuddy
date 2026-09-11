// Canonical list of reserved URL tokens and system routes that cannot be claimed as college slugs
const RESERVED_SLUGS = new Set([
  'admin',
  'super-admin',
  'superadmin',
  'api',
  'auth',
  'login',
  'register',
  'signup',
  'logout',
  'portal',
  'dashboard',
  'system',
  'root',
  'support',
  'help',
  'helpdesk',
  'settings',
  'config',
  'configuration',
  'public',
  'static',
  'assets',
  'c',
  'app',
  'null',
  'undefined',
  'general',
  'student',
  'college-admin',
  'librarian',
  'operator',
  'billing',
  'subscription',
  'webhook',
  'webhooks',
  'terms',
  'privacy',
  'docs',
  'status',
  'health',
  'metrics',
  'version',
  'catalog',
  'loans',
  'fines',
  'facilities',
  'eresources',
  'e-resources',
  'reading-lists',
  'recommendations',
  'patron-card',
]);

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 40;

/**
 * Checks whether a candidate slug is a reserved system keyword.
 * @param {string} slug
 * @returns {boolean}
 */
const isSlugReserved = (slug) => {
  if (!slug || typeof slug !== 'string') return false;
  const normalized = slug.toLowerCase().trim();
  return RESERVED_SLUGS.has(normalized);
};

/**
 * Validates slug format and length constraints.
 * @param {string} slug
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateSlugFormat = (slug) => {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, reason: 'Slug is required and must be a string.' };
  }
  const normalized = slug.toLowerCase().trim();
  if (normalized.length < MIN_SLUG_LENGTH || normalized.length > MAX_SLUG_LENGTH) {
    return {
      valid: false,
      reason: `Slug must be between ${MIN_SLUG_LENGTH} and ${MAX_SLUG_LENGTH} characters.`,
    };
  }
  if (!SLUG_REGEX.test(normalized)) {
    return {
      valid: false,
      reason:
        'Slug must contain only lowercase letters, numbers, and hyphens without consecutive or edge hyphens.',
    };
  }
  if (isSlugReserved(normalized)) {
    return {
      valid: false,
      reason: 'Slug is a reserved system keyword and cannot be claimed.',
    };
  }
  return { valid: true };
};

module.exports = {
  RESERVED_SLUGS,
  SLUG_REGEX,
  MIN_SLUG_LENGTH,
  MAX_SLUG_LENGTH,
  isSlugReserved,
  validateSlugFormat,
};
