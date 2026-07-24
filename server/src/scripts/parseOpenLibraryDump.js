const fs = require('fs');
const readline = require('readline');
const zlib = require('zlib');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const OpenLibraryBook = require('../models/OpenLibraryBook');

const BATCH_SIZE = 1000;

/**
 * Extracts and maps cover URL from Open Library entity JSON.
 */
function extractCoverUrl(doc) {
  if (Array.isArray(doc.covers) && doc.covers.length > 0) {
    const coverId = doc.covers.find((c) => typeof c === 'number' && c > 0);
    if (coverId) {
      return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
    }
  }

  const isbns = Array.isArray(doc.isbn_13)
    ? doc.isbn_13
    : Array.isArray(doc.isbn_10)
    ? doc.isbn_10
    : [];
  if (isbns.length > 0) {
    return `https://covers.openlibrary.org/b/isbn/${isbns[0]}-L.jpg`;
  }

  return null;
}

/**
 * Transforms raw Open Library TSV line JSON into database model format.
 */
function transformDumpRecord(doc) {
  if (!doc || !doc.key || !doc.title) return null;

  const key = doc.key;
  const title = doc.title;
  const authorNames = Array.isArray(doc.by_statement)
    ? [doc.by_statement]
    : typeof doc.by_statement === 'string'
    ? [doc.by_statement]
    : [];

  let firstPublishYear = null;
  if (doc.publish_date) {
    const yearMatch = doc.publish_date.match(/\b(18|19|20)\d{2}\b/);
    if (yearMatch) firstPublishYear = parseInt(yearMatch[0], 10);
  }

  const isbn = [
    ...(Array.isArray(doc.isbn_13) ? doc.isbn_13 : []),
    ...(Array.isArray(doc.isbn_10) ? doc.isbn_10 : []),
  ];

  const coverImageUrl = extractCoverUrl(doc);
  const subjects = Array.isArray(doc.subjects) ? doc.subjects.slice(0, 10) : [];
  const publisher = Array.isArray(doc.publishers) ? doc.publishers.slice(0, 5) : [];

  return {
    openLibraryKey: key,
    title,
    authorNames,
    firstPublishYear,
    isbn,
    coverImageUrl,
    subjects,
    publisher,
    lastIngestedAt: new Date(),
  };
}

/**
 * Streams massive Open Library dump (.txt or .txt.gz) line-by-line into database.
 * Enforces backpressure via readline pause/resume to guarantee low memory usage.
 */
async function parseDumpFile(dumpFilePath) {
  if (!fs.existsSync(dumpFilePath)) {
    throw new Error(`Dump file not found at path: ${dumpFilePath}`);
  }

  console.log(`[Dump Parser] Starting stream processing for: ${dumpFilePath}`);
  const startTime = Date.now();

  let fileStream = fs.createReadStream(dumpFilePath);

  // Auto-decompress if .gz archive
  if (dumpFilePath.endsWith('.gz')) {
    console.log('[Dump Parser] Gzip format detected. Piping through Gunzip stream...');
    const gunzip = zlib.createGunzip();
    fileStream = fileStream.pipe(gunzip);
  }

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let batch = [];
  let totalLinesProcessed = 0;
  let totalSavedRecords = 0;
  let skippedLines = 0;

  async function flushBatch() {
    if (batch.length === 0) return;

    const operations = batch.map((record) => ({
      updateOne: {
        filter: { openLibraryKey: record.openLibraryKey },
        update: { $set: record },
        upsert: true,
      },
    }));

    try {
      const res = await OpenLibraryBook.bulkWrite(operations, { ordered: false });
      totalSavedRecords += (res.upsertedCount || 0) + (res.modifiedCount || 0);
    } catch (err) {
      console.error('[Dump Parser] Error writing batch to database:', err.message);
    } finally {
      batch = [];
    }
  }

  for await (const line of rl) {
    totalLinesProcessed++;

    if (totalLinesProcessed % 20000 === 0) {
      const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      console.log(
        `[Dump Parser] Processed ${totalLinesProcessed} lines... Saved: ${totalSavedRecords} records. Heap Usage: ${memoryUsage} MB`
      );
    }

    if (!line || line.trim().length === 0) continue;

    // Open Library dump format: type \t key \t revision \t last_modified \t JSON
    const parts = line.split('\t');
    const jsonStr = parts[4] || parts[parts.length - 1];

    if (!jsonStr || !jsonStr.startsWith('{')) {
      skippedLines++;
      continue;
    }

    try {
      const rawDoc = JSON.parse(jsonStr);
      const record = transformDumpRecord(rawDoc);

      if (record) {
        batch.push(record);
      } else {
        skippedLines++;
      }
    } catch {
      skippedLines++;
    }

    // Enforce backpressure and batch execution
    if (batch.length >= BATCH_SIZE) {
      rl.pause();
      await flushBatch();
      rl.resume();
    }
  }

  // Flush remaining records in queue
  await flushBatch();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Dump Parser] Complete!`);
  console.log(`[Dump Parser] Total lines read: ${totalLinesProcessed}`);
  console.log(`[Dump Parser] Total records saved: ${totalSavedRecords}`);
  console.log(`[Dump Parser] Skipped lines: ${skippedLines}`);
  console.log(`[Dump Parser] Duration: ${durationSec} seconds`);
}

// Standalone CLI Runner
if (require.main === module) {
  const dumpArg = process.argv[2];
  if (!dumpArg) {
    console.error('Usage: node parseOpenLibraryDump.js <path-to-ol_dump.txt.gz>');
    process.exit(1);
  }

  const absoluteDumpPath = path.resolve(dumpArg);
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy';

  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log('[Dump Parser] Connected to MongoDB database.');
      await parseDumpFile(absoluteDumpPath);
      await mongoose.disconnect();
      console.log('[Dump Parser] Disconnected from MongoDB database.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Dump Parser] Fatal Error:', err);
      process.exit(1);
    });
}

module.exports = {
  parseDumpFile,
  transformDumpRecord,
};
