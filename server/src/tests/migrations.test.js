const mongoose = require('mongoose');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function runMigrationUp(dbUri) {
  const migrationRunner = `
    const migrateMongo = require('migrate-mongo');
    (async () => {
      migrateMongo.config.set({
        mongodb: { url: process.env.MONGO_URI, options: {} },
        migrationsDir: 'migrations',
        changelogCollectionName: 'changelog',
        migrationFileExtension: '.js',
        useFileHash: false,
        moduleSystem: 'commonjs',
      });

      const { db, client } = await migrateMongo.database.connect();
      const migrated = await migrateMongo.up(db, client);
      await client.close();
      process.stdout.write(JSON.stringify(migrated));
    })().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  `;

  const { stdout } = await execFileAsync(process.execPath, ['-e', migrationRunner], {
    cwd: process.cwd(),
    env: { ...process.env, MONGO_URI: dbUri },
  });

  return JSON.parse(stdout || '[]');
}

describe('Database Migration Integration & Idempotency Tests', () => {
  const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_migration_test';

  beforeAll(async () => {
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
    const migrated = await runMigrationUp(dbUri);

    expect(Array.isArray(migrated)).toBe(true);
    expect(migrated.length).toBeGreaterThan(0);

    const changelog = await mongoose.connection.db.collection('changelog').find({}).toArray();
    expect(changelog.length).toBe(migrated.length);
  });

  test('2. Running migrate-mongo up a second time is idempotent (no new migrations applied)', async () => {
    const migratedSecondRun = await runMigrationUp(dbUri);

    expect(Array.isArray(migratedSecondRun)).toBe(true);
    expect(migratedSecondRun.length).toBe(0);
  });
});
