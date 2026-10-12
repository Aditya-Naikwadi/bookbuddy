/**
 * Middleware to enforce strict private, non-cacheable responses on per-user endpoints.
 * Prevents intermediate CDNs, reverse proxies, and shared browser caches from storing or leaking
 * sensitive user annotations, bookmarks, reading progress, and reader positions.
 */
const noCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'private, no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    Vary: 'Authorization, Cookie, Accept-Encoding',
  });
  next();
};

module.exports = noCache;
