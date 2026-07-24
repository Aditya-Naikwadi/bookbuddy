const axios = require('axios');

/**
 * OpenLibraryService
 * Safe, rate-limited client for Open Library API integration.
 */
class OpenLibraryService {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://openlibrary.org';
    this.coversUrl = options.coversUrl || 'https://covers.openlibrary.org';
    this.userAgent =
      options.userAgent ||
      process.env.OPEN_LIBRARY_USER_AGENT ||
      'BookBuddy/1.0 (dev@bookbuddy.com)';
    this.timeout = options.timeout || 10000; // 10s fallback timeout
    this.minIntervalMs = 550; // Minimum 550ms between requests (~1.8 req/sec, strictly < 2 req/sec)
    this.lastRequestTime = 0;
    this.maxRetries = options.maxRetries || 3;

    // Axios client with mandated User-Agent header
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
    });
  }

  /**
   * Internal rate limiter enforcing < 2 requests per second across all calls.
   */
  async _rateLimitGuard() {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;

    if (timeSinceLast < this.minIntervalMs) {
      const delay = this.minIntervalMs - timeSinceLast;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Safe request wrapper with rate-limiting and exponential backoff retry.
   */
  async _executeRequest(endpoint, params = {}, retryCount = 0) {
    await this._rateLimitGuard();

    try {
      const response = await this.client.get(endpoint, { params });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const isRetryable =
        !status || status === 429 || (status >= 500 && status <= 599);

      if (isRetryable && retryCount < this.maxRetries) {
        const backoffDelay = Math.pow(2, retryCount) * 1000 + Math.random() * 200;
        console.warn(
          `[OpenLibraryService] Request failed (${error.message}). Retrying in ${Math.round(backoffDelay)}ms (Attempt ${retryCount + 1}/${this.maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        return this._executeRequest(endpoint, params, retryCount + 1);
      }

      console.error(`[OpenLibraryService] API Call Error (${endpoint}):`, error.message);
      throw error;
    }
  }

  /**
   * Maps cover ID or ISBN to Open Library Cover Image URL.
   */
  getCoverImageUrl(coverI, isbnList = []) {
    if (coverI) {
      return `${this.coversUrl}/b/id/${coverI}-L.jpg`;
    }
    const validIsbn = Array.isArray(isbnList)
      ? isbnList.find((i) => i && i.length >= 10)
      : isbnList;
    if (validIsbn) {
      return `${this.coversUrl}/b/isbn/${validIsbn}-L.jpg`;
    }
    return null;
  }

  /**
   * Normalizes raw API response item to application schema.
   */
  normalizeBookRecord(rawDoc) {
    const key = rawDoc.key;
    const title = rawDoc.title || 'Untitled';
    const authorNames = Array.isArray(rawDoc.author_name)
      ? rawDoc.author_name
      : rawDoc.author_name
      ? [rawDoc.author_name]
      : [];
    const firstPublishYear = rawDoc.first_publish_year || null;
    const isbn = Array.isArray(rawDoc.isbn) ? rawDoc.isbn : rawDoc.isbn ? [rawDoc.isbn] : [];
    const coverImageUrl = this.getCoverImageUrl(rawDoc.cover_i, isbn);
    const subjects = Array.isArray(rawDoc.subject) ? rawDoc.subject.slice(0, 10) : [];
    const publisher = Array.isArray(rawDoc.publisher) ? rawDoc.publisher.slice(0, 5) : [];

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
   * Search books from Open Library endpoint.
   * Query: https://openlibrary.org/search.json?q=[search_query]&page=[page]
   */
  async searchBooks(query, page = 1, limit = 100) {
    if (!query) throw new Error('Search query is required');

    const data = await this._executeRequest('/search.json', {
      q: query,
      page,
      limit,
    });

    const docs = data.docs || [];
    const normalizedBooks = docs.map((doc) => this.normalizeBookRecord(doc));

    return {
      numFound: data.numFound || 0,
      start: data.start || 0,
      page,
      books: normalizedBooks,
    };
  }
}

module.exports = new OpenLibraryService();
module.exports.OpenLibraryService = OpenLibraryService;
