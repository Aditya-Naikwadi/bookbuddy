const cron = require('node-cron');
const { syncTopic } = require('./bookAggregator');

const DEFAULT_TOPICS = [
  'physics',
  'machine learning',
  'history',
  'computer science',
  'mathematics',
];
const CRON_SCHEDULE = process.env.SYNC_CRON_SCHEDULE || '0 2 * * *'; // Default 2:00 AM daily
const MAX_RETRIES = 3;

let isRunning = false;

/**
 * Execute sync for a single topic with exponential backoff retry logic
 */
const syncTopicWithRetry = async (topic, attempt = 1) => {
  try {
    return await syncTopic(topic);
  } catch (error) {
    if (attempt <= MAX_RETRIES) {
      const backoffMs = Math.pow(2, attempt) * 1000;
      // eslint-disable-next-line no-console
      console.warn(
        `[Cron Retry] Topic "${topic}" failed (Attempt ${attempt}/${MAX_RETRIES}, Error: ${error.message}). Retrying in ${backoffMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return syncTopicWithRetry(topic, attempt + 1);
    } else {
      // eslint-disable-next-line no-console
      console.error(`[Cron Error] Exceeded max retries for topic "${topic}":`, error.message);
      return null;
    }
  }
};

/**
 * Worker execution routine over target topic list
 */
const runAggregationJob = async (topics = DEFAULT_TOPICS) => {
  if (isRunning) {
    // eslint-disable-next-line no-console
    console.warn('[Cron Worker] Job skipped — Previous sync job is still running.');
    return;
  }

  isRunning = true;
  // eslint-disable-next-line no-console
  console.log(`[Cron Worker] Scheduled ingestion job started at ${new Date().toISOString()}`);

  const results = [];
  for (const topic of topics) {
    const res = await syncTopicWithRetry(topic);
    if (res) results.push(res);
  }

  isRunning = false;
  // eslint-disable-next-line no-console
  console.log(`[Cron Worker] Job completed. Processed ${results.length} topics.`);
};

/**
 * Initialize background cron schedule
 */
const initCronWorker = () => {
  // eslint-disable-next-line no-console
  console.log(`[Cron Worker] Initializing scheduler with expression: "${CRON_SCHEDULE}"`);
  cron.schedule(CRON_SCHEDULE, () => {
    runAggregationJob().catch((err) =>
      // eslint-disable-next-line no-console
      console.error('[Cron Worker Unhandled Exception]:', err)
    );
  });
};

module.exports = { initCronWorker, runAggregationJob };
