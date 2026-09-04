const axios = require('axios');
const NodeCache = require('node-cache');
const Book = require('../models/Book');

// 1-hour in-memory cache for API requests
const cache = new NodeCache({ stdTTL: 3600 });

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
const TIMEOUT_MS = 10000;

/**
 * Normalizes a Google Books volume object to BookBuddy's schema format.
 */
const normalizeGoogleBook = (item) => {
  const info = item.volumeInfo || {};
  const imageLinks = info.imageLinks || {};

  let isbn;
  if (Array.isArray(info.industryIdentifiers) && info.industryIdentifiers.length > 0) {
    const primaryIsbn = info.industryIdentifiers.find(
      (id) => id.type === 'ISBN_13' || id.type === 'ISBN_10'
    );
    isbn = primaryIsbn ? primaryIsbn.identifier : info.industryIdentifiers[0].identifier;
  } else {
    isbn = `GB-${item.id}`;
  }

  // Cover image URL normalization (ensure HTTPS)
  let coverImage = imageLinks.thumbnail || imageLinks.smallThumbnail || null;
  if (coverImage && coverImage.startsWith('http:')) {
    coverImage = coverImage.replace('http:', 'https:');
  }

  const authors = Array.isArray(info.authors)
    ? info.authors.join(', ')
    : info.authors || 'Unknown Author';
  const categories = Array.isArray(info.categories)
    ? info.categories[0]
    : info.categories || 'General';
  const publishedYear = info.publishedDate
    ? parseInt(info.publishedDate.substring(0, 4), 10) || null
    : null;

  return {
    googleVolumeId: item.id,
    isbn,
    title: info.title || 'Untitled',
    author: authors,
    category: categories,
    description: info.description || '',
    publisher: info.publisher || '',
    publishedYear,
    pageCount: info.pageCount || 0,
    language: info.language || 'en',
    coverImage,
    previewLink: info.previewLink || info.infoLink || null,
    source: 'google_books',
  };
};

/**
 * Search books via Google Books API
 */
const searchBooks = async ({ search = 'programming', category, page = 1, limit = 12 }) => {
  const startIndex = (page - 1) * limit;
  let q = search;
  if (category) {
    q += `+subject:${category}`;
  }

  const cacheKey = `gb_search_${q}_${startIndex}_${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        q,
        key: API_KEY,
        startIndex,
        maxResults: limit,
        printType: 'books',
      },
      timeout: TIMEOUT_MS,
    });

    const totalItems = response.data.totalItems || 0;
    const items = (response.data.items || []).map(normalizeGoogleBook);

    const result = {
      total: totalItems,
      page: Number(page),
      pages: Math.ceil(totalItems / limit),
      books: items,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Google Books Service] Search Error:`, error.message);
    throw new Error(`Google Books API search failed: ${error.message}`);
  }
};

/**
 * Fetch a single Google Book by volume ID
 */
const getBookById = async (volumeId) => {
  const cacheKey = `gb_volume_${volumeId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${BASE_URL}/${volumeId}`, {
      params: { key: API_KEY },
      timeout: TIMEOUT_MS,
    });

    const normalized = normalizeGoogleBook(response.data);
    cache.set(cacheKey, normalized);
    return normalized;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Google Books Service] Volume Fetch Error (${volumeId}):`, error.message);
    throw new Error(`Google Books API fetch failed for ID ${volumeId}: ${error.message}`);
  }
};

/**
 * Seed Google Books into the local database for a given collegeId
 */
const seedBooksToDatabase = async (collegeId, topics = ['computer science']) => {
  let seededCount = 0;
  let skippedCount = 0;

  for (const topic of topics) {
    try {
      const { books } = await searchBooks({ search: topic, limit: 10 });
      for (const bookData of books) {
        const existing = await Book.findOne({
          collegeId,
          isbn: bookData.isbn,
        });

        if (!existing && bookData.isbn) {
          await Book.create({
            ...bookData,
            collegeId,
            format: 'digital',
            copiesTotal: 5,
            copiesAvailable: 5,
            shelfLocation: 'Digital Shelf / Google Books',
          });
          seededCount++;
        } else {
          skippedCount++;
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[Google Books Service] Seed error for topic "${topic}":`, err.message);
    }
  }

  return { seededCount, skippedCount };
};

module.exports = {
  searchBooks,
  getBookById,
  normalizeGoogleBook,
  seedBooksToDatabase,
};
