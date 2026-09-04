const config = require('./src/config');

module.exports = {
  mongodb: {
    url: process.env.MONGO_URI || config.mongoUri || 'mongodb://127.0.0.1:27017/bookbuddy',
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};
