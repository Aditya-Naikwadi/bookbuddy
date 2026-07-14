// Middleware to catch unmatched routes and forward a 404 AppError.
const AppError = require('../utils/AppError');

const notFound = (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
};

module.exports = notFound;
