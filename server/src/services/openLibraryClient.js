const axios = require('axios');
const RateLimiter = require('../utils/rateLimiter');

const BASE_URL = 'https://openlibrary.org/search.json';
const USER_AGENT = process.env.OPEN_LIBRARY_USER_AGENT || 'BookBuddy/1.0 (dev@bookbuddy.com)';
const TIMEOUT_MS = 10000;

// Rate-limiter guaranteeing max 1.8 requests/second (< 2 req/sec)
const limiter = new RateLimiter(1.8);

/**
 * Fetch books from Open Library API with rate-limiting and custom User-Agent
 */
const fetchOpenLibraryBooks = async (query, limit = 20) => {
  try {
    await limiter.acquire();

    const response = await axios.get(BASE_URL, {
      params: { q: query, limit },
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      timeout: TIMEOUT_MS,
    });

    if (!response.data || !Array.isArray(response.data.docs)) return [];

    return response.data.docs.map((doc) => {
      const isbns = Array.isArray(doc.isbn) ? doc.isbn.map((i) => i.replace(/[^0-9X]/gi, '')) : [];
      const authors = Array.isArray(doc.author_name) ? doc.author_name : [];

      // Cover Image Mapping: https://covers.openlibrary.org/b/id/{cover_i}-L.jpg
      const coverImageUrl = doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null;

      const publishYear =
        doc.first_publish_year || (Array.isArray(doc.publish_year) ? doc.publish_year[0] : null);

      return {
        title: doc.title || 'Untitled',
        authors,
        description: doc.subtitle || '',
        publishYear,
        isbns,
        coverImageUrl,
        downloadLinks: {
          readUrl: doc.key ? `https://openlibrary.org${doc.key}` : null,
        },
        source: 'open_library',
      };
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Open Library Error] Failed to fetch query "${query}":`, error.message);
    return [];
  }
};

module.exports = { fetchOpenLibraryBooks };
