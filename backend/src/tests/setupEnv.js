const path = require('path');
const dotenv = require('dotenv');

// Preload backend/.env before any test suite loads in worker processes
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let atlasUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (atlasUri && atlasUri.includes('/bookbuddy?')) {
  atlasUri = atlasUri.replace('/bookbuddy?', '/bookbuddy_test?');
}

if (atlasUri && (atlasUri.startsWith('mongodb+srv://') || atlasUri.includes('@'))) {
  process.env.MONGO_URI = atlasUri;
  process.env.MONGODB_URI = atlasUri;
  global.__ORIGINAL_ATLAS_TEST_URI__ = atlasUri;
}
