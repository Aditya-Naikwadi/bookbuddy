const cacheHelper = require('../utils/cacheHelper');
const logger = require('../utils/logger');
const { searchBooks } = require('./googleBooksService');

// In-flight request coalescing registry
const inFlightSearches = new Map();

// Upstream call instrumentation for verification
let upstreamCallCount = 0;

const getUpstreamCallCount = () => upstreamCallCount;
const resetUpstreamCallCount = () => {
  upstreamCallCount = 0;
};

/**
 * Normalizes query parameters into a deterministic canonical cache key
 */
const normalizeQuery = ({ q = '', category = '', page = 1, limit = 12 }) => {
  const cleanQ = String(q).trim().toLowerCase();
  const cleanCat = String(category).trim().toLowerCase();
  const cleanPage = parseInt(page, 10) || 1;
  const cleanLimit = parseInt(limit, 10) || 12;
  return `gs:${cleanQ}:${cleanCat}:${cleanPage}:${cleanLimit}`;
};

/**
 * Executes an upstream search with a hard 5-second timeout and fallback
 */
const executeWithTimeout = async (searchFn, params, timeoutMs = 5000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`Upstream search timed out after ${timeoutMs}ms`);
      err.code = 'UPSTREAM_TIMEOUT';
      reject(err);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([searchFn(params), timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

/**
 * Perform general search with Redis caching (20m TTL) and in-flight coalescing
 */
const executeGeneralSearch = async (params = {}, customSearchFn = null) => {
  const cacheKey = normalizeQuery(params);
  const REDIS_TTL_SECONDS = 1200; // 20 minutes

  // 1. Check Redis Cache
  const cached = await cacheHelper.get(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // 2. In-flight Request Coalescing
  if (inFlightSearches.has(cacheKey)) {
    logger.info(`[GeneralSearch] Coalescing request for key: ${cacheKey}`);
    return await inFlightSearches.get(cacheKey);
  }

  // 3. Initiate Single In-Flight Upstream Call
  const searchPromise = (async () => {
    try {
      upstreamCallCount++;
      const searchFn =
        customSearchFn ||
        (async (p) => {
          return await searchBooks({
            search: p.q || 'general',
            category: p.category,
            page: p.page,
            limit: p.limit,
          });
        });

      const data = await executeWithTimeout(searchFn, params, 5000);

      // Cache in Redis for 20 minutes
      await cacheHelper.set(cacheKey, data, REDIS_TTL_SECONDS);

      return { ...data, fromCache: false };
    } catch (err) {
      logger.warn(`[GeneralSearch] Upstream fetch failure for key ${cacheKey}: ${err.message}`);
      // Graceful degradation fallback
      return {
        total: 0,
        page: params.page || 1,
        pages: 1,
        books: [],
        fallback: true,
        error: err.message,
      };
    } finally {
      // Evict in-flight record once settled
      inFlightSearches.delete(cacheKey);
    }
  })();

  inFlightSearches.set(cacheKey, searchPromise);
  return await searchPromise;
};

module.exports = {
  executeGeneralSearch,
  normalizeQuery,
  getUpstreamCallCount,
  resetUpstreamCallCount,
  inFlightSearches,
};
