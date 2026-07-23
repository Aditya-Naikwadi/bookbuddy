/**
 * Custom NoSQL injection protection middleware compatible with Express 5.
 * Recursively strips keys starting with '$' or containing '.' from request body, query, and params.
 */
const sanitizeObject = (obj) => {
  if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    for (const key of keys) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        sanitizeObject(obj[key]);
      }
    }
  }
  return obj;
};

const mongoSanitize = (req, res, next) => {
  if (req.body) {
    sanitizeObject(req.body);
  }
  if (req.params) {
    sanitizeObject(req.params);
  }
  if (req.query) {
    try {
      // Express 5 query object is read-only via prototype getter.
      // To sanitize safely, we clone, clean, and redefine the query property on the req object.
      const cleanedQuery = sanitizeObject(JSON.parse(JSON.stringify(req.query)));
      Object.defineProperty(req, 'query', {
        value: cleanedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      // Fallback in case JSON serialization/redefinition fails
      sanitizeObject(req.query);
    }
  }
  next();
};

module.exports = mongoSanitize;
