const mongoose = require('mongoose');
const UnifiedBook = require('../models/UnifiedBook');
const { upsertCandidateBook } = require('../services/bookAggregator');

const TEST_MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_aggregator_test';

describe('Educational Book Aggregator - Deduplication & Upsert Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGO_URI);
    }
  });

  afterAll(async () => {
    await UnifiedBook.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await UnifiedBook.deleteMany({});
  });

  test('Inserts a new book when no duplicate exists', async () => {
    const candidate = {
      title: 'Quantum Computing Principles',
      authors: ['Alice Smith'],
      description: 'Introductory book on quantum mechanics.',
      publishYear: 2021,
      isbns: ['9781234567890'],
      coverImageUrl: 'https://example.com/cover1.jpg',
      downloadLinks: { readUrl: 'https://example.com/read' },
      source: 'google_books',
    };

    const res = await upsertCandidateBook(candidate);
    expect(res.action).toBe('inserted');

    const count = await UnifiedBook.countDocuments();
    expect(count).toBe(1);

    const doc = await UnifiedBook.findById(res.id);
    expect(doc.title).toBe('Quantum Computing Principles');
    expect(doc.sources).toContain('google_books');
  });

  test('Primary Deduplication Match by ISBN merges missing fields', async () => {
    // Initial insertion from Google Books
    await upsertCandidateBook({
      title: 'Quantum Computing',
      authors: ['Alice Smith'],
      description: 'Short description.',
      publishYear: 2021,
      isbns: ['9781234567890'],
      coverImageUrl: 'https://example.com/google_cover.jpg',
      downloadLinks: { readUrl: 'https://example.com/google_read' },
      source: 'google_books',
    });

    // Subsequent candidate from Gutendex matching ISBN with EPUB link & longer description
    const candidate2 = {
      title: 'Quantum Computing Overview',
      authors: ['Alice Smith', 'Bob Jones'],
      description: 'Much longer and detailed description of quantum computing.',
      publishYear: null,
      isbns: ['9781234567890'],
      coverImageUrl: null,
      downloadLinks: { epub: 'https://example.com/book.epub' },
      source: 'gutendex',
    };

    const res = await upsertCandidateBook(candidate2);
    expect(res.action).toBe('merged');

    const doc = await UnifiedBook.findById(res.id);
    expect(doc.sources).toEqual(expect.arrayContaining(['google_books', 'gutendex']));
    expect(doc.downloadLinks.epub).toBe('https://example.com/book.epub');
    expect(doc.downloadLinks.readUrl).toBe('https://example.com/google_read');
    expect(doc.coverImageUrl).toBe('https://example.com/google_cover.jpg');
    expect(doc.authors).toContain('Bob Jones');
  });

  test('Secondary Deduplication Match by Normalized Title + Author merges data', async () => {
    // Initial book without ISBN
    await upsertCandidateBook({
      title: 'Data Structures and Algorithms',
      authors: ['John Doe'],
      description: 'Core concepts.',
      publishYear: 2018,
      isbns: [],
      coverImageUrl: null,
      downloadLinks: {},
      source: 'open_library',
    });

    // Candidate with same normalized Title + Author
    const candidate = {
      title: 'Data Structures & Algorithms!',
      authors: ['John Doe'],
      description: 'Extended concepts.',
      publishYear: 2018,
      isbns: ['9780987654321'],
      coverImageUrl: 'https://example.com/cover_ol.jpg',
      downloadLinks: {},
      source: 'google_books',
    };

    const res = await upsertCandidateBook(candidate);
    expect(res.action).toBe('merged');

    const doc = await UnifiedBook.findById(res.id);
    expect(doc.isbns).toContain('9780987654321');
    expect(doc.coverImageUrl).toBe('https://example.com/cover_ol.jpg');
  });
});
