const mongoose = require('mongoose');

beforeEach(async () => {
  if (mongoose.connection.readyState === 0 && process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
  }
  const { resetAllLimiters } = require('../middlewares/rateLimiters');
  resetAllLimiters();
});

// Wrap mongoose connection closing functions to introduce a 500ms grace period.
// This allows pending async operations (like audit log writes) to settle gracefully,
// preventing "MongoClient closed" errors when tests teardown under high latency.
const originalClose = mongoose.connection.close;
const originalDisconnect = mongoose.disconnect;

mongoose.connection.close = async function (...args) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return originalClose.apply(this, args);
};

mongoose.disconnect = async function (...args) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return originalDisconnect.apply(this, args);
};
