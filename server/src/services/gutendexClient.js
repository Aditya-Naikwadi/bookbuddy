const axios = require('axios');

const BASE_URL = 'https://gutendex.com/books';
const TIMEOUT_MS = 10000;

/**
 * Fetch public domain books from Gutendex API by topic query
 */
const fetchGutendexBooks = async (query) => {
  try {
    const response = await axios.get(BASE_URL, {
      params: { search: query },
      timeout: TIMEOUT_MS,
    });

    if (!response.data || !Array.isArray(response.data.results)) return [];

    return response.data.results.map((book) => {
      const formats = book.formats || {};

      // Extract direct download formats
      const epub = formats['application/epub+zip'] || null;
      const text =
        formats['text/plain; charset=utf-8'] ||
        formats['text/plain; charset=us-ascii'] ||
        formats['text/plain'] ||
        null;
      const readUrl = formats['text/html'] || formats['text/html; charset=utf-8'] || null;
      const coverImageUrl = formats['image/jpeg'] || null;

      const authors = Array.isArray(book.authors)
        ? book.authors.map((a) => a.name).filter(Boolean)
        : [];

      return {
        title: book.title || 'Untitled',
        authors,
        description: Array.isArray(book.subjects) ? book.subjects.join(', ') : '',
        publishYear: null,
        isbns: [],
        coverImageUrl,
        downloadLinks: {
          epub,
          text,
          readUrl,
        },
        source: 'gutendex',
      };
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Gutendex Error] Failed to fetch query "${query}":`, error.message);
    return [];
  }
};

module.exports = { fetchGutendexBooks };
