const migrateMongo = require('migrate-mongo');
const mongoose = require('mongoose');

describe('Database Migration Integration & Idempotency Tests', () => {
  const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_migration_test';

  beforeAll(async () => {
    migrateMongo.config.set({
      mongodb: {
        url: dbUri,
        options: {},
      },
      migrationsDir: 'migrations',
      changelogCollectionName: 'changelog',
      migrationFileExtension: '.js',
      useFileHash: false,
      moduleSystem: 'commonjs',
    });

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(dbUri);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  });

  test('1. Runs full migrate-mongo up sequence against database', async () => {
    const { db, client } = await migrateMongo.database.connect();
    const migrated = await migrateMongo.up(db, client);

    expect(Array.isArray(migrated)).toBe(true);
    expect(migrated.length).toBeGreaterThan(0);

    const changelog = await db.collection('changelog').find({}).toArray();
    expect(changelog.length).toBe(migrated.length);

    await client.close();
  });

  test('2. Running migrate-mongo up a second time is idempotent (no new migrations applied)', async () => {
    const { db, client } = await migrateMongo.database.connect();
    const migratedSecondRun = await migrateMongo.up(db, client);

    expect(Array.isArray(migratedSecondRun)).toBe(true);
    expect(migratedSecondRun.length).toBe(0);

    await client.close();
  });
});
