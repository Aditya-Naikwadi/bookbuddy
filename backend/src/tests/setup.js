const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');

if (process.env.MONGO_URI && process.env.MONGO_URI.includes('/bookbuddy?')) {
  process.env.MONGO_URI = process.env.MONGO_URI.replace('/bookbuddy?', '/bookbuddy_test?');
}

jest.setTimeout(30000);

const connectToDb = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2) {
    try {
      await mongoose.connection.asPromise();
    } catch {
      // Ignore
    }
    return;
  }
  if (mongoose.connection.readyState === 0) {
    const primaryUri = process.env.MONGO_URI;
    const fallbackUris = [
      'mongodb://127.0.0.1:27017/bookbuddy_test',
      'mongodb://localhost:27017/bookbuddy_test',
    ];
    const uris = Array.from(new Set([primaryUri, ...fallbackUris])).filter(Boolean);

    for (const uri of uris) {
      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          bufferCommands: false,
          tlsAllowInvalidCertificates: true,
        });
        break;
      } catch {
        // Try next fallback URI
      }
    }
  }
};

beforeAll(async () => {
  await connectToDb();
});

beforeEach(async () => {
  await connectToDb();
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

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 2) {
      await mongoose.connection.asPromise().catch(() => {});
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  } catch {
    // Squelch teardown errors
  }
});
