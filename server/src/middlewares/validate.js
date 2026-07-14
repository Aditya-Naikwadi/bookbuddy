const AppError = require('../utils/AppError');

const validate = (schema) => (req, res, next) => {
  try {
    const validData = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    // Overwrite request objects with parsed/sanitized/coerced data
    if (validData.body) req.body = validData.body;
    if (validData.query) req.query = validData.query;
    if (validData.params) req.params = validData.params;
    next();
  } catch (err) {
    // Collect all Zod error messages
    const errorMessages = err.errors
      ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      : err.message;
    next(new AppError(`Validation Error: ${errorMessages}`, 400));
  }
};

module.exports = validate;
