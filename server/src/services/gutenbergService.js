const axios = require('axios');
const NodeCache = require('node-cache');

// Initialize cache with 1 hour TTL (3600 seconds)
const cache = new NodeCache({ stdTTL: process.env.GUTENDEX_CACHE_TTL_SECONDS || 3600 });

const BASE_URL = process.env.GUTENDEX_BASE_URL || 'https://gutendex.com';
const TIMEOUT_MS = process.env.GUTENDEX_TIMEOUT_MS || 5000;

class UpstreamUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UpstreamUnavailableError';
    this.statusCode = 503;
  }
}

// Map a Gutendex book object to BookBuddy's format
const normalizeBook = (book) => {
  return {
    source: 'gutenberg',
    externalId: book.id,
    title: book.title,
    author: book.authors?.map(a => a.name).join(', ') || 'Unknown Author',
    category: book.subjects?.[0] || 'Public Domain',
    language: book.languages?.[0] || 'en',
    coverImage: book.formats?.['image/jpeg'] || null,
    readUrl: book.formats?.['text/html'] || null,
    epubUrl: book.formats?.['application/epub+zip'] || null,
    downloadCount: book.download_count || 0
  };
};

const searchBooks = async ({ search, language, topic, page }) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (language) params.append('languages', language);
  if (topic) params.append('topic', topic);
  if (page) params.append('page', page);

  const queryStr = params.toString();
  const cacheKey = `search_${queryStr}`;

  // Check Cache
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await axios.get(`${BASE_URL}/books?${queryStr}`, { timeout: TIMEOUT_MS });
    
    const normalizedData = {
      totalCount: response.data.count,
      nextPage: response.data.next ? new URL(response.data.next).searchParams.get('page') : null,
      items: response.data.results.map(normalizeBook)
    };

    // Store in cache
    cache.set(cacheKey, normalizedData);
    
    return normalizedData;
  } catch (error) {
    console.error(`[Gutendex Service] Error searching books: ${error.message}`);
    throw new UpstreamUnavailableError('Gutenberg catalog is temporarily unavailable');
  }
};

const getBookById = async (gutenbergId) => {
  const cacheKey = `book_${gutenbergId}`;

  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await axios.get(`${BASE_URL}/books/${gutenbergId}`, { timeout: TIMEOUT_MS });
    const normalizedBook = normalizeBook(response.data);
    
    cache.set(cacheKey, normalizedBook);
    
    return normalizedBook;
  } catch (error) {
    console.error(`[Gutendex Service] Error fetching book ${gutenbergId}: ${error.message}`);
    throw new UpstreamUnavailableError('Gutenberg catalog is temporarily unavailable');
  }
};

module.exports = {
  searchBooks,
  getBookById,
  UpstreamUnavailableError
};
