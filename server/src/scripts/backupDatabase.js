const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Stream-based memory-safe database backup function
 */
const backupDatabase = async (targetDir = null) => {
  try {
    const mongoUri =
      process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookbuddy';
    console.log(`[Backup] Connecting to MongoDB: ${mongoUri}`);

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = targetDir || path.join(__dirname, '../../backups', `backup-${timestamp}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`[Backup] Starting memory-bounded stream backup to directory: ${backupDir}`);

    const manifest = {
      timestamp: new Date().toISOString(),
      databaseName: db.databaseName,
      collections: [],
    };

    for (const col of collections) {
      const collectionName = col.name;
      if (collectionName.startsWith('system.')) continue;

      const filePath = path.join(backupDir, `${collectionName}.json`);
      const writeStream = fs.createWriteStream(filePath, { flags: 'w' });
      const hash = crypto.createHash('sha256');

      let documentCount = 0;
      let totalBytes = 0;

      writeStream.write('[\n');

      const cursor = db.collection(collectionName).find({});
      let isFirst = true;

      for await (const doc of cursor) {
        const jsonLine = (isFirst ? '' : ',\n') + JSON.stringify(doc);
        isFirst = false;

        writeStream.write(jsonLine);
        hash.update(jsonLine);
        totalBytes += Buffer.byteLength(jsonLine);
        documentCount++;
      }

      writeStream.write('\n]');
      hash.update('\n]');
      totalBytes += 2;

      await new Promise((resolve, reject) => {
        writeStream.end((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const finalHash = hash.digest('hex');

      manifest.collections.push({
        name: collectionName,
        count: documentCount,
        sizeBytes: totalBytes,
        checksumSha256: finalHash,
        file: `${collectionName}.json`,
      });

      console.log(
        `  ✓ Streamed collection '${collectionName}': ${documentCount} docs (${finalHash.substring(0, 10)}...)`
      );
    }

    // Save Manifest File
    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`\n[Backup] SUCCESS! Stream backup saved at: ${backupDir}`);
    return backupDir;
  } catch (error) {
    console.error('[Backup Error] Failed to create streaming database backup:', error);
    throw error;
  }
};

if (require.main === module) {
  backupDatabase()
    .then(() => {
      mongoose.disconnect();
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { backupDatabase };
