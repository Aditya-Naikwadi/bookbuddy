const { algoliasearch } = require('algoliasearch');
const logger = require('./logger');

const indexName = process.env.ALGOLIA_INDEX_NAME || 'bookbuddy_books';

const isAlgoliaConfigured = () => {
  return Boolean(process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_ADMIN_KEY);
};

let client = null;

if (isAlgoliaConfigured()) {
  try {
    client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_KEY);
  } catch (err) {
    logger.warn('Failed to initialize Algolia client:', err.message);
  }
}

/**
 * Transforms Mongoose Book document into Algolia record schema
 */
const formatBookForAlgolia = (book) => {
  return {
    objectID: book._id.toString(),
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    category: book.category,
    coverImage: book.coverImage || '',
    format: book.format,
    publishedYear: book.publishedYear,
    language: book.language,
    availableCopies: book.availableCopies,
    collegeId: book.collegeId ? book.collegeId.toString() : '',
  };
};

/**
 * Save or update book in Algolia Index
 */
const saveBookToAlgolia = async (book) => {
  if (!client || !isAlgoliaConfigured()) return false;
  try {
    const record = formatBookForAlgolia(book);
    await client.saveObject({
      indexName,
      body: record,
    });
    return true;
  } catch (err) {
    logger.warn(`Failed to sync book ${book._id} to Algolia:`, err.message);
    return false;
  }
};

/**
 * Delete book record from Algolia Index
 */
const deleteBookFromAlgolia = async (bookId) => {
  if (!client || !isAlgoliaConfigured()) return false;
  try {
    await client.deleteObject({
      indexName,
      objectID: bookId.toString(),
    });
    return true;
  } catch (err) {
    logger.warn(`Failed to delete book ${bookId} from Algolia:`, err.message);
    return false;
  }
};

/**
 * Query Algolia index for sub-50ms typo-tolerant search
 */
const searchBooksInAlgolia = async (queryText, filters = {}) => {
  if (!client || !isAlgoliaConfigured()) return null;
  try {
    const searchParams = {
      query: queryText,
      hitsPerPage: filters.limit || 12,
      page: (filters.page || 1) - 1,
    };

    if (filters.collegeId) {
      searchParams.filters = `collegeId:${filters.collegeId}`;
    }

    const { results } = await client.search({
      requests: [
        {
          indexName,
          ...searchParams,
        },
      ],
    });

    const hits = results[0]?.hits || [];
    const nbHits = results[0]?.nbHits || 0;
    const nbPages = results[0]?.nbPages || 0;

    return {
      objectIDs: hits.map((h) => h.objectID),
      hits,
      total: nbHits,
      pages: nbPages,
    };
  } catch (err) {
    logger.warn('Algolia search query failed, falling back to MongoDB:', err.message);
    return null;
  }
};

module.exports = {
  isAlgoliaConfigured,
  saveBookToAlgolia,
  deleteBookFromAlgolia,
  searchBooksInAlgolia,
};
