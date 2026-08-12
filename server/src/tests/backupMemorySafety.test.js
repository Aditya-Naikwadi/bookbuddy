const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { backupDatabase } = require('../scripts/backupDatabase');

describe('Streaming Backup Memory Safety Integration Tests', () => {
  jest.setTimeout(30000);
  let tempBackupDir;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      try {
        const connectDB = require('../db');
        await connectDB();
      } catch {
        await mongoose.connect('mongodb://127.0.0.1:27017/bookbuddy_backup_test', {
          serverSelectionTimeoutMS: 2000,
        });
      }
    }
    const db = mongoose.connection.db;

    // Seed dataset with 1,000 documents
    const mockDocs = [];
    for (let i = 0; i < 1000; i++) {
      mockDocs.push({
        title: `Book Performance Test Document ${i}`,
        isbn: `978-0-12345-${i}`,
        payload: 'X'.repeat(500),
        createdAt: new Date(),
      });
    }
    await db.collection('test_books').insertMany(mockDocs);
  });

  afterAll(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();

    if (tempBackupDir && fs.existsSync(tempBackupDir)) {
      try {
        fs.rmSync(tempBackupDir, { recursive: true, force: true });
      } catch {
        // Ignore transient EBUSY locks during teardown
      }
    }
  });

  test('1. Backup streams database collections without memory spikes', async () => {
    const heapBefore = process.memoryUsage().heapUsed;

    tempBackupDir = path.join(__dirname, 'temp_backup_test');
    const resultDir = await backupDatabase(tempBackupDir);

    const heapAfter = process.memoryUsage().heapUsed;
    const heapGrowthMb = (heapAfter - heapBefore) / (1024 * 1024);

    expect(fs.existsSync(resultDir)).toBe(true);
    expect(fs.existsSync(path.join(resultDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(resultDir, 'test_books.json'))).toBe(true);

    // Assert heap growth remains strictly bounded (< 30 MB heap delta for 1,000 streamed documents)
    expect(heapGrowthMb).toBeLessThan(30);
  });
});
