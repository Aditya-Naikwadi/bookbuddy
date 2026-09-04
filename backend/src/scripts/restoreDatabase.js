const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const restoreDatabase = async () => {
  try {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const targetDirArg = args.find((a) => !a.startsWith('--'));

    const backupsBaseDir = path.join(__dirname, '../../backups');
    let backupDir = targetDirArg;

    if (!backupDir) {
      // Find latest backup directory
      if (!fs.existsSync(backupsBaseDir)) {
        console.error('[Restore Error] No backups directory found at:', backupsBaseDir);
        process.exit(1);
      }
      const dirs = fs.readdirSync(backupsBaseDir).filter((d) => d.startsWith('backup-'));
      if (dirs.length === 0) {
        console.error('[Restore Error] No backup directories found inside:', backupsBaseDir);
        process.exit(1);
      }
      dirs.sort();
      backupDir = path.join(backupsBaseDir, dirs[dirs.length - 1]);
    }

    if (!fs.existsSync(backupDir)) {
      console.error('[Restore Error] Specified backup directory does not exist:', backupDir);
      process.exit(1);
    }

    console.log(`[Restore] Target Backup Directory: ${backupDir}`);
    if (isDryRun) console.log('[Restore Mode] DRY-RUN (No changes will be written to MongoDB)');

    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error('[Restore Error] Missing manifest.json in backup directory.');
      process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(
      `[Restore] Manifest Date: ${manifest.timestamp} | Database: ${manifest.databaseName}`
    );

    // Verify Checksums
    for (const col of manifest.collections) {
      const filePath = path.join(backupDir, col.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Backup file missing: ${col.file}`);
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      if (hash !== col.checksumSha256) {
        throw new Error(`Checksum mismatch for file ${col.file}! Data may be corrupted.`);
      }
    }
    console.log('✓ All SHA-256 checksums verified successfully.');

    if (isDryRun) {
      console.log('\n[Dry-Run Summary] Ready to restore:');
      manifest.collections.forEach((c) => {
        console.log(`  - ${c.name}: ${c.count} records (${(c.sizeBytes / 1024).toFixed(1)} KB)`);
      });
      console.log(
        '\n[Dry-Run Complete] Run without --dry-run to perform actual database restoration.'
      );
      process.exit(0);
    }

    const mongoUri =
      process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookbuddy';
    console.log(`[Restore] Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    for (const col of manifest.collections) {
      const filePath = path.join(backupDir, col.file);
      const docs = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (docs.length > 0) {
        // Convert string $oid and $date if needed
        const parsedDocs = docs.map((doc) => {
          if (doc._id && doc._id.$oid) doc._id = new mongoose.Types.ObjectId(doc._id.$oid);
          if (doc.createdAt && doc.createdAt.$date) doc.createdAt = new Date(doc.createdAt.$date);
          if (doc.updatedAt && doc.updatedAt.$date) doc.updatedAt = new Date(doc.updatedAt.$date);
          return doc;
        });

        const collection = db.collection(col.name);
        await collection.deleteMany({});
        await collection.insertMany(parsedDocs, { ordered: false });
        console.log(`  ✓ Restored collection '${col.name}': ${docs.length} records`);
      }
    }

    console.log('\n[Restore] SUCCESS! All collections restored to MongoDB.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Restore Error] Restoration failed:', error);
    process.exit(1);
  }
};

restoreDatabase();
