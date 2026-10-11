const path = require('path');
const dotenv = require('dotenv');

// Preload backend/.env before any test suite loads in worker processes
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let atlasUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (atlasUri && atlasUri.includes('/bookbuddy?')) {
  atlasUri = atlasUri.replace('/bookbuddy?', '/bookbuddy_test?');
}

if (atlasUri && (atlasUri.startsWith('mongodb+srv://') || atlasUri.includes('@'))) {
  let currentUri = atlasUri;
  Object.defineProperty(process.env, 'MONGO_URI', {
    get() {
      return currentUri;
    },
    set(val) {
      // If test file attempts to overwrite with an unreachable local MongoDB URL, preserve the working Atlas test URI
      if (!val || val.includes('localhost') || val.includes('127.0.0.1')) {
        return;
      }
      currentUri = val;
    },
    configurable: true,
    enumerable: true,
  });
}
