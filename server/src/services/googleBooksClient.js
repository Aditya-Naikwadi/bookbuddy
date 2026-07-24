const axios = require('axios');

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';
const TIMEOUT_MS = 10000;

/**
 * Fetch books from Google Books API by topic/search query
 */
const fetchGoogleBooks = async (query, maxResults = 20) => {
  try {
    const params = {
      q: query,
      maxResults,
      printType: 'books',
    };

    if (API_KEY) {
      params.key = API_KEY;
    }

    const response = await axios.get(BASE_URL, {
      params,
      timeout: TIMEOUT_MS,
    });

    if (!response.data || !Array.isArray(response.data.items)) return [];

    return response.data.items.map((item) => {
      const info = item.volumeInfo || {};
      const imageLinks = info.imageLinks || {};

      // Extract ISBNs
      const isbns = [];
      if (Array.isArray(info.industryIdentifiers)) {
        info.industryIdentifiers.forEach((idObj) => {
          if (idObj.identifier) {
            isbns.push(idObj.identifier.replace(/[^0-9X]/gi, ''));
          }
        });
      }

      // Ensure HTTPS for cover image URL
      let coverImage = imageLinks.thumbnail || imageLinks.smallThumbnail || null;
      if (coverImage && coverImage.startsWith('http:')) {
        coverImage = coverImage.replace('http:', 'https:');
      }

      // Parse Publish Year
      const publishYear = info.publishedDate
        ? parseInt(info.publishedDate.substring(0, 4), 10) || null
        : null;

      return {
        title: info.title || 'Untitled',
        authors: Array.isArray(info.authors) ? info.authors : [],
        description: info.description || '',
        publishYear,
        isbns,
        coverImageUrl: coverImage,
        downloadLinks: {
          readUrl: info.previewLink || info.infoLink || null,
        },
        source: 'google_books',
      };
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Google Books Error] Failed to fetch query "${query}":`, error.message);
    return [];
  }
};

module.exports = { fetchGoogleBooks };
