const UnifiedBook = require('../models/UnifiedBook');
const { fetchGoogleBooks } = require('./googleBooksClient');
const { fetchGutendexBooks } = require('./gutendexClient');
const { fetchOpenLibraryBooks } = require('./openLibraryClient');

const logger = require('../utils/logger');

/**
 * Deduplicate and upsert candidate book into MongoDB
 */
const upsertCandidateBook = async (candidate) => {
  const normalizedKey = UnifiedBook.generateNormalizedKey(candidate.title, candidate.authors);
  candidate.normalizedTitleAuthor = normalizedKey;

  let existingBook = null;

  // 1. Primary Check: Match by ISBN array if available
  if (Array.isArray(candidate.isbns) && candidate.isbns.length > 0) {
    existingBook = await UnifiedBook.findOne({ isbns: { $in: candidate.isbns } });
  }

  // 2. Secondary Check: Match by Normalized Title + Author
  if (!existingBook && normalizedKey) {
    existingBook = await UnifiedBook.findOne({ normalizedTitleAuthor: normalizedKey });
  }

  if (existingBook) {
    // MERGE LOGIC: Merge missing fields
    let modified = false;

    // Merge ISBNs
    if (candidate.isbns && candidate.isbns.length > 0) {
      const mergedIsbns = Array.from(new Set([...existingBook.isbns, ...candidate.isbns]));
      if (mergedIsbns.length !== existingBook.isbns.length) {
        existingBook.isbns = mergedIsbns;
        modified = true;
      }
    }

    // Merge Authors
    if (candidate.authors && candidate.authors.length > 0) {
      const mergedAuthors = Array.from(new Set([...existingBook.authors, ...candidate.authors]));
      if (mergedAuthors.length !== existingBook.authors.length) {
        existingBook.authors = mergedAuthors;
        modified = true;
      }
    }

    // Merge Cover Image URL
    if (!existingBook.coverImageUrl && candidate.coverImageUrl) {
      existingBook.coverImageUrl = candidate.coverImageUrl;
      modified = true;
    }

    // Merge Description
    if (
      candidate.description &&
      candidate.description.length > (existingBook.description || '').length
    ) {
      existingBook.description = candidate.description;
      modified = true;
    }

    // Merge Publish Year
    if (!existingBook.publishYear && candidate.publishYear) {
      existingBook.publishYear = candidate.publishYear;
      modified = true;
    }

    // Merge Download Links
    const dl = existingBook.downloadLinks || {};
    const candDl = candidate.downloadLinks || {};
    if (!dl.epub && candDl.epub) {
      dl.epub = candDl.epub;
      modified = true;
    }
    if (!dl.pdf && candDl.pdf) {
      dl.pdf = candDl.pdf;
      modified = true;
    }
    if (!dl.text && candDl.text) {
      dl.text = candDl.text;
      modified = true;
    }
    if (!dl.readUrl && candDl.readUrl) {
      dl.readUrl = candDl.readUrl;
      modified = true;
    }
    existingBook.downloadLinks = dl;

    // Track Sources
    if (!existingBook.sources.includes(candidate.source)) {
      existingBook.sources.push(candidate.source);
      modified = true;
    }

    if (modified) {
      await existingBook.save();
    }
    return { action: 'merged', id: existingBook._id };
  } else {
    // INSERT NEW BOOK
    const newBook = new UnifiedBook({
      title: candidate.title,
      authors: candidate.authors,
      description: candidate.description,
      publishYear: candidate.publishYear,
      isbns: candidate.isbns,
      coverImageUrl: candidate.coverImageUrl,
      downloadLinks: candidate.downloadLinks,
      sources: [candidate.source],
      normalizedTitleAuthor: normalizedKey,
    });
    await newBook.save();
    return { action: 'inserted', id: newBook._id };
  }
};

/**
 * Main Sync Pipeline: Concurrently fetches from all 3 APIs & runs deduplicated ingestion
 */
const syncTopic = async (topic) => {
  // eslint-disable-next-line no-console
  console.log(`[Aggregator] Starting sync for topic: "${topic}"`);

  // Execute API fetches concurrently with error isolation
  const [googleRes, gutendexRes, openLibRes] = await Promise.allSettled([
    fetchGoogleBooks(topic),
    fetchGutendexBooks(topic),
    fetchOpenLibraryBooks(topic),
  ]);

  if (googleRes.status === 'rejected') {
    logger.warn(
      `[Aggregator Source Warning] Google Books fetch failed: ${googleRes.reason?.message || googleRes.reason}`
    );
  }
  if (gutendexRes.status === 'rejected') {
    logger.warn(
      `[Aggregator Source Warning] Gutendex fetch failed: ${gutendexRes.reason?.message || gutendexRes.reason}`
    );
  }
  if (openLibRes.status === 'rejected') {
    logger.warn(
      `[Aggregator Source Warning] OpenLibrary fetch failed: ${openLibRes.reason?.message || openLibRes.reason}`
    );
  }

  const googleBooks = googleRes.status === 'fulfilled' ? googleRes.value : [];
  const gutendexBooks = gutendexRes.status === 'fulfilled' ? gutendexRes.value : [];
  const openLibBooks = openLibRes.status === 'fulfilled' ? openLibRes.value : [];

  const allCandidates = [...googleBooks, ...gutendexBooks, ...openLibBooks];
  logger.info(
    `[Aggregator] Fetched ${allCandidates.length} total candidates (Google: ${googleBooks.length}, Gutenberg: ${gutendexBooks.length}, OpenLibrary: ${openLibBooks.length})`
  );

  let insertedCount = 0;
  let mergedCount = 0;

  for (const candidate of allCandidates) {
    try {
      const res = await upsertCandidateBook(candidate);
      if (res.action === 'inserted') insertedCount++;
      if (res.action === 'merged') mergedCount++;
    } catch (err) {
      logger.error(
        `[Aggregator Error] Failed to process candidate "${candidate.title}": ${err.message}`
      );
    }
  }

  logger.info(
    `[Aggregator Summary] Topic "${topic}" -> Inserted: ${insertedCount}, Merged: ${mergedCount}`
  );
  return { topic, insertedCount, mergedCount, totalCandidates: allCandidates.length };
};

module.exports = { syncTopic, upsertCandidateBook };
