const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Validates whether a URL has a safe protocol or is a safe relative URL.
 * Rejects javascript:, data:, vbscript:, and control characters.
 *
 * @param {string} url - The URL string to validate.
 * @returns {boolean} True if the URL is safe to render in href or navigate to.
 */
function isSafeUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject strings containing ASCII control characters or null bytes
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return false;
  }

  // Reject protocol-relative URLs (e.g. "//evil.com")
  if (trimmed.startsWith('//')) {
    return false;
  }

  // Allow safe relative URLs starting with / or # or ?
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?')
  ) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return SAFE_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    // If URL parsing fails, check if relative (e.g. "./foo" or "path/to/resource")
    // Ensure no colon before the first slash (to prevent scheme bypass like "javascript:foo")
    const colonIndex = trimmed.indexOf(':');
    const slashIndex = trimmed.indexOf('/');
    if (colonIndex !== -1 && (slashIndex === -1 || colonIndex < slashIndex)) {
      return false;
    }
    return true;
  }
}

/**
 * Sanitizes a URL for safe usage in href, window.open, or redirects.
 * Returns fallback (defaulting to '#') if unsafe.
 *
 * @param {string} url - The untrusted URL.
 * @param {string} fallback - Fallback URL if unsafe (default: '#').
 * @returns {string} Safe URL.
 */
function sanitizeUrl(url, fallback = '#') {
  if (isSafeUrl(url)) {
    return url.trim();
  }
  return fallback;
}

module.exports = {
  isSafeUrl,
  sanitizeUrl,
};
