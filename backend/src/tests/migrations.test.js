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

  test('0. Migrations succeed against a database with pre-existing schema-level indexes (autoIndex simulation)', async () => {
    // Simulate the real-world condition: Mongoose's autoIndex creates schema-level
    // indexes BEFORE any migration runs. This is the exact scenario that caused
    // the providerEventId conflict — the schema declares { unique: true } and
    // the migration tried to create { sparse: true } under the same index name.
    const db = mongoose.connection.db;

    // Pre-create the Payment schema's autoIndex for providerEventId (unique only, no sparse).
    // This mirrors what Mongoose <=v7 autoIndex would create from `unique: true, index: true`
    // BEFORE the schema was updated to also include `sparse: true`.
    try {
      await db
        .collection('payments')
        .createIndex({ providerEventId: 1 }, { unique: true, name: 'providerEventId_1' });
    } catch {
      // Collection/index may already exist — that's fine
    }

    // Pre-create the Annotation schema's compound index (matching schema.index() exactly)
    try {
      await db.collection('annotations').createIndex({ userId: 1, resourceId: 1 });
    } catch {
      // ignore
    }

    // Pre-create the RefreshToken schema's compound index
    try {
      await db.collection('refreshtokens').createIndex({ userId: 1, expiresAt: 1 });
    } catch {
      // ignore
    }

    // Now run the full migration suite — should NOT throw despite pre-existing indexes
    const { db: migrateDb, client } = await migrateMongo.database.connect();
    const migrated = await migrateMongo.up(migrateDb, client);

    expect(Array.isArray(migrated)).toBe(true);
    expect(migrated.length).toBeGreaterThan(0);

    // Verify the providerEventId index now has both unique AND sparse
    const paymentIndexes = await migrateDb.collection('payments').indexes();
    const providerEventIdx = paymentIndexes.find((idx) => idx.name === 'providerEventId_1');
    expect(providerEventIdx).toBeDefined();
    expect(providerEventIdx.unique).toBe(true);
    expect(providerEventIdx.sparse).toBe(true);

    await client.close();
  });

  test('1. Running migrate-mongo up a second time is idempotent (no new migrations applied)', async () => {
    const { db, client } = await migrateMongo.database.connect();
    const migratedSecondRun = await migrateMongo.up(db, client);

    expect(Array.isArray(migratedSecondRun)).toBe(true);
    expect(migratedSecondRun.length).toBe(0);

    await client.close();
  });

  test('2. Full migrate-mongo down then up round-trip succeeds', async () => {
    const { db, client } = await migrateMongo.database.connect();

    // Down all migrations
    const downResults = await migrateMongo.down(db, client);
    expect(Array.isArray(downResults)).toBe(true);

    // Up again — should re-apply all without conflict
    // Need to down all remaining migrations first
    let moreDown = downResults;
    while (moreDown.length > 0) {
      moreDown = await migrateMongo.down(db, client);
    }

    const reApplied = await migrateMongo.up(db, client);
    expect(Array.isArray(reApplied)).toBe(true);
    expect(reApplied.length).toBeGreaterThan(0);

    await client.close();
  });

  afterAll(async () => {
    try {
      const Payment = require('../models/Payment');
      if (mongoose.connection && mongoose.connection.db) {
        try {
          await mongoose.connection.db.collection('payments').dropIndex('providerEventId_1');
        } catch (_err) {
          // Index may already be dropped
        }
        await Payment.syncIndexes();
      }
    } catch (_err) {
      // Connection may already be closed
    }
  });
});
