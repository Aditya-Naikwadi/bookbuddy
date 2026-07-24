const cron = require('node-cron');
const mongoose = require('mongoose');
require('dotenv').config();

const openLibraryService = require('../services/openLibraryService');
const OpenLibraryBook = require('../models/OpenLibraryBook');

// Predefined list of educational topics
const DEFAULT_TOPICS = [
  'artificial intelligence',
  'biology',
  'physics',
  'computer science',
  'mathematics',
  'chemistry',
];

const PAGES_PER_TOPIC = 2; // Fetch top pages per topic to respect rate limits
const BATCH_SIZE = 100;

/**
 * Upserts a batch of normalized book records into the database.
 */
async function upsertBookBatch(books) {
  if (!books || books.length === 0) return { upsertedCount: 0, modifiedCount: 0 };

  const operations = books.map((book) => ({
    updateOne: {
      filter: { openLibraryKey: book.openLibraryKey },
      update: { $set: book },
      upsert: true,
    },
  }));

  const result = await OpenLibraryBook.bulkWrite(operations, { ordered: false });
  return {
    upsertedCount: result.upsertedCount || 0,
    modifiedCount: result.modifiedCount || 0,
  };
}

/**
 * Ingestion task loop over educational topics.
 */
async function runScheduledIngestion(topics = DEFAULT_TOPICS) {
  console.log(`[Cron Ingestion] Starting educational book ingestion at ${new Date().toISOString()}...`);
  let totalProcessed = 0;
  let totalUpserted = 0;
  let totalModified = 0;

  for (const topic of topics) {
    console.log(`[Cron Ingestion] Fetching books for topic: "${topic}"...`);

    for (let page = 1; page <= PAGES_PER_TOPIC; page++) {
      try {
        const { books, numFound } = await openLibraryService.searchBooks(topic, page, BATCH_SIZE);
        if (!books || books.length === 0) break;

        const { upsertedCount, modifiedCount } = await upsertBookBatch(books);
        totalProcessed += books.length;
        totalUpserted += upsertedCount;
        totalModified += modifiedCount;

        console.log(
          `[Cron Ingestion] Topic "${topic}" (Page ${page}): Processed ${books.length} / Total ${numFound}. (New: ${upsertedCount}, Updated: ${modifiedCount})`
        );
      } catch (error) {
        console.error(`[Cron Ingestion] Failed to ingest topic "${topic}" page ${page}:`, error.message);
        // Continue to next page/topic resiliently
      }
    }
  }

  console.log(
    `[Cron Ingestion] Ingestion completed. Summary: ${totalProcessed} processed, ${totalUpserted} new inserted, ${totalModified} existing updated.`
  );
}

/**
 * Schedules cron worker if invoked directly or exports scheduler.
 * Schedule format: '0 2 * * *' (Every day at 2:00 AM)
 */
function initScheduler(cronExpression = '0 2 * * *') {
  console.log(`[Cron Ingestion] Registering Open Library Ingestion Cron Schedule (${cronExpression})...`);
  cron.schedule(cronExpression, async () => {
    try {
      await runScheduledIngestion();
    } catch (err) {
      console.error('[Cron Ingestion] Fatal error during scheduled execution:', err);
    }
  });
}

// Standalone CLI execution support
if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy';
  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log('[Cron Ingestion] Connected to MongoDB');
      await runScheduledIngestion();
      await mongoose.disconnect();
      console.log('[Cron Ingestion] Database disconnected');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Cron Ingestion] DB Connection Error:', err);
      process.exit(1);
    });
}

module.exports = {
  runScheduledIngestion,
  initScheduler,
};
