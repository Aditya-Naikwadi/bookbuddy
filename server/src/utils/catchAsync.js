/**
 * Universal Async Route Handler Wrapper
 * Wraps express async controllers to automatically catch rejected promises
 * and pass them to the global Express error middleware (next(err)).
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
