const AppError = require('../utils/AppError');

const validate = (schema) => (req, res, next) => {
  try {
    const validData = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    // Optional: Overwrite with parsed/sanitized data
    // req.body = validData.body;
    // req.query = validData.query;
    // req.params = validData.params;
    next();
  } catch (err) {
    // Collect all Zod error messages
    const errorMessages = err.errors ? err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') : err.message;
    next(new AppError(`Validation Error: ${errorMessages}`, 400));
  }
};

module.exports = validate;
