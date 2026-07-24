const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const backupDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookbuddy';
    console.log(`[Backup] Connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../../backups', `backup-${timestamp}`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log(`[Backup] Starting backup process to directory: ${backupDir}`);

    const manifest = {
      timestamp: new Date().toISOString(),
      databaseName: db.databaseName,
      collections: [],
    };

    for (const col of collections) {
      const collectionName = col.name;
      if (collectionName.startsWith('system.')) continue;

      const docs = await db.collection(collectionName).find({}).toArray();
      const filePath = path.join(backupDir, `${collectionName}.json`);
      const jsonContent = JSON.stringify(docs, null, 2);

      fs.writeFileSync(filePath, jsonContent, 'utf8');

      // Calculate SHA-256 Checksum
      const hash = crypto.createHash('sha256').update(jsonContent).digest('hex');

      manifest.collections.push({
        name: collectionName,
        count: docs.length,
        sizeBytes: Buffer.byteLength(jsonContent),
        checksumSha256: hash,
        file: `${collectionName}.json`,
      });

      console.log(`  ✓ Backed up collection '${collectionName}': ${docs.length} documents (${hash.substring(0, 10)}...)`);
    }

    // Save Manifest File
    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`\n[Backup] SUCCESS! Complete backup saved at: ${backupDir}`);
    console.log(`[Backup] Manifest created with ${manifest.collections.length} collections.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Backup Error] Failed to create database backup:', error);
    process.exit(1);
  }
};

backupDatabase();
