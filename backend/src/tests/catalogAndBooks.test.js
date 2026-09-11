/**
 * Consolidated Suite: catalog And Books
 * Merged from:
 *  - bookModel.test.js
 *  - bookAggregator.test.js
 *  - aggregatorEndpoint.test.js
 *  - publicCatalogSearch.test.js
 *  - tagAutocomplete.test.js
 *  - tagMigration.test.js
 *  - library.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('catalog And Books Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: bookModel.test.js]', () => {
    const mongoose = require('mongoose');
    const Book = require('../models/Book');

    describe('Book Model Schema - Rating Aggregates', () => {
      test('defaults avgRating and ratingCount to 0 for new documents', () => {
        const book = new Book({
          collegeId: new mongoose.Types.ObjectId(),
          isbn: '978-0123456789',
          title: 'Test Rating Book',
          author: 'Test Author',
          category: 'Science',
        });

        expect(book.avgRating).toBe(0);
        expect(book.ratingCount).toBe(0);
      });

      test('existing documents without rating fields load correctly defaulting to 0', () => {
        const rawDoc = {
          _id: new mongoose.Types.ObjectId(),
          collegeId: new mongoose.Types.ObjectId(),
          isbn: '978-9876543210',
          title: 'Legacy Book',
          author: 'Legacy Author',
          category: 'Fiction',
        };

        const book = Book.hydrate(rawDoc);

        expect(book.avgRating).toBe(0);
        expect(book.ratingCount).toBe(0);
      });
    });
  });

  describe('[Source: bookAggregator.test.js]', () => {
    const mongoose = require('mongoose');
    const UnifiedBook = require('../models/UnifiedBook');
    const { upsertCandidateBook } = require('../services/bookAggregator');

    const TEST_MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_aggregator_test';

    describe('Educational Book Aggregator - Deduplication & Upsert Tests', () => {
      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          try {
            await mongoose.connect(TEST_MONGO_URI, {
              serverSelectionTimeoutMS: 2000,
              connectTimeoutMS: 2000,
              bufferCommands: false,
            });
          } catch {
            // Ignore connection failure in unit test mode
          }
        }
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await UnifiedBook.deleteMany({}).catch(() => {});
          // await // mongoose.disconnect();.catch(() => {});
        }
      });

      beforeEach(async () => {
        if (mongoose.connection.readyState !== 0) {
          await UnifiedBook.deleteMany({}).catch(() => {});
        }
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
  });

  describe('[Source: aggregatorEndpoint.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_aggregator_endpoint_test';
    process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

    jest.setTimeout(30000);

    const app = require('../app');
    const UnifiedBook = require('../models/UnifiedBook');
    const Book = require('../models/Book');
    const College = require('../models/College');
    const User = require('../models/User');
    const { generateTokenPair } = require('../utils/token');

    describe('Aggregator Endpoint & Global Access Regression Tests', () => {
      let college1, college2;
      let userCollege1Token, userCollege2Token;
      let sampleUnifiedBook1, sampleUnifiedBook2;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        // 1. Create test colleges
        college1 = await College.create({
          name: 'Test Aggregator College 1',
          code: 'TAC1',
          domain: 'tac1.edu',
          status: 'active',
        });

        college2 = await College.create({
          name: 'Test Aggregator College 2',
          code: 'TAC2',
          domain: 'tac2.edu',
          status: 'active',
        });

        // 2. Create users & tokens for College 1 and College 2
        const user1 = await User.create({
          name: 'Student College 1',
          email: 'student1@tac1.edu',
          password: 'Password123!',
          role: 'student',
          studentId: 'STU-TAC1-001',
          collegeId: college1._id,
          college: college1._id,
          isVerified: true,
          isActive: true,
        });

        const user2 = await User.create({
          name: 'Student College 2',
          email: 'student2@tac2.edu',
          password: 'Password123!',
          role: 'student',
          studentId: 'STU-TAC2-002',
          collegeId: college2._id,
          college: college2._id,
          isVerified: true,
          isActive: true,
        });

        userCollege1Token = generateTokenPair(user1).accessToken;
        userCollege2Token = generateTokenPair(user2).accessToken;

        // 3. Create global UnifiedBook records (aggregated from external sources)
        sampleUnifiedBook1 = await UnifiedBook.create({
          title: 'Introduction to Algorithms (Aggregated)',
          authors: ['Thomas H. Cormen'],
          description: 'Comprehensive computer science textbook.',
          publishYear: 2009,
          isbns: ['9780262033848'],
          coverImageUrl: 'https://example.com/algo.jpg',
          sources: ['google_books', 'open_library'],
          normalizedTitleAuthor: 'introduction to algorithms thomas h cormen',
        });

        sampleUnifiedBook2 = await UnifiedBook.create({
          title: 'Frankenstein (Public Domain Aggregated)',
          authors: ['Mary Wollstonecraft Shelley'],
          description: 'Classic Gothic horror novel.',
          publishYear: 1818,
          isbns: ['9780141439471'],
          coverImageUrl: 'https://example.com/frankenstein.jpg',
          sources: ['gutendex'],
          normalizedTitleAuthor: 'frankenstein mary wollstonecraft shelley',
        });

        // 4. Create physical tenant-scoped books to verify physical catalog isolation is intact
        await Book.create({
          title: 'College 1 Physical Manual',
          author: 'Professor Alpha',
          category: 'Computer Science',
          isbn: '1111111111111',
          collegeId: college1._id,
          college: college1._id,
          copiesTotal: 5,
          copiesAvailable: 5,
          status: 'available',
        });
      });

      afterAll(async () => {
        if (sampleUnifiedBook1 && sampleUnifiedBook2) {
          await UnifiedBook.deleteMany({
            _id: { $in: [sampleUnifiedBook1._id, sampleUnifiedBook2._id] },
          }).catch(() => {});
        }
        if (college1 && college2) {
          await Book.deleteMany({ collegeId: { $in: [college1._id, college2._id] } }).catch(
            () => {}
          );
          await User.deleteMany({
            email: { $in: ['student1@tac1.edu', 'student2@tac2.edu'] },
          }).catch(() => {});
          await College.deleteMany({ _id: { $in: [college1._id, college2._id] } }).catch(() => {});
        }
        // await // mongoose.disconnect();.catch(() => {});
      });

      test('GET /api/v1/aggregator returns global aggregated books to User from College 1', async () => {
        const res = await request(app)
          .get('/api/v1/aggregator')
          .set('Authorization', `Bearer ${userCollege1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      });

      test('GET /api/v1/aggregator returns identical global aggregated books to User from College 2', async () => {
        const res = await request(app)
          .get('/api/v1/aggregator')
          .set('Authorization', `Bearer ${userCollege2Token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      });

      test('GET /api/v1/aggregator supports searching by title/author/description query', async () => {
        const res = await request(app).get('/api/v1/aggregator?q=Algorithms');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].title).toContain('Introduction to Algorithms');
      });

      test('Physical catalog tenant-isolation remains strictly enforced and unchanged', async () => {
        // User from College 2 should be Forbidden when attempting to access College 1 physical books endpoint
        const res = await request(app)
          .get(`/api/v1/college/${college1._id}/books`)
          .set('Authorization', `Bearer ${userCollege2Token}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Forbidden');
      });
    });
  });

  describe('[Source: publicCatalogSearch.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_public_search_test';

    const app = require('../app');
    const Book = require('../models/Book');
    const College = require('../models/College');
    const User = require('../models/User');
    const { generateAccessToken } = require('../utils/token');
    const { searchCatalogBooks } = require('../services/catalogSearchService');

    describe('Public Resources & Advanced Search Integration (P2)', () => {
      let collegeA, collegeB;
      let studentA;
      let tokenStudentA;
      let publicBookA, restrictedBookA, publicBookB, restrictedBookB;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await Book.deleteMany({});
        await College.deleteMany({});
        await User.deleteMany({});

        collegeA = await College.create({
          name: 'Alpha Institute',
          shortName: 'ALPHA',
          code: `ALPHA_${Date.now()}`,
        });

        collegeB = await College.create({
          name: 'Beta University',
          shortName: 'BETA',
          code: `BETA_${Date.now()}`,
        });

        studentA = await User.create({
          studentId: `STU_A_${Date.now()}`,
          name: 'Alice Student',
          email: `alice_${Date.now()}@alpha.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });
        tokenStudentA = generateAccessToken(studentA);

        // Seed Books
        // 1. Public-eligible book in College A
        publicBookA = await Book.create({
          collegeId: collegeA._id,
          title: 'Shared Algorithms Manual',
          author: 'Donald Knuth',
          isbn: '978-0201896831',
          category: 'Computer Science',
          format: 'physical',
          copiesTotal: 5,
          copiesAvailable: 3,
          isShareableAcrossColleges: true,
        });

        // 2. College-restricted book in College A (NOT shareable / private)
        restrictedBookA = await Book.create({
          collegeId: collegeA._id,
          title: 'Alpha Private Exam Prep',
          author: 'Alpha Faculty',
          isbn: '978-1111111111',
          category: 'Exam Prep',
          format: 'physical',
          copiesTotal: 2,
          copiesAvailable: 2,
          isShareableAcrossColleges: false,
        });

        // 3. Public-eligible book in College B
        publicBookB = await Book.create({
          collegeId: collegeB._id,
          title: 'Open Chemistry Handbook',
          author: 'Marie Curie',
          isbn: '978-0486603445',
          category: 'Chemistry',
          format: 'digital',
          copiesTotal: 10,
          copiesAvailable: 10,
          isShareableAcrossColleges: true,
        });

        // 4. College-restricted book in College B
        restrictedBookB = await Book.create({
          collegeId: collegeB._id,
          title: 'Beta Secret Research Notes',
          author: 'Beta Lab',
          isbn: '978-2222222222',
          category: 'Chemistry',
          format: 'digital',
          copiesTotal: 1,
          copiesAvailable: 1,
          isShareableAcrossColleges: false,
        });
      });

      afterAll(async () => {
        await Book.deleteMany({});
        await College.deleteMany({});
        await User.deleteMany({});
        // await // mongoose.connection.close();
      });

      describe('Shared catalogSearchService unit behavior', () => {
        it('1. should only return public-eligible books when scope is public', async () => {
          const result = await searchCatalogBooks({ scope: 'public' });
          const titles = result.books.map((b) => b.title);

          expect(titles).toContain('Shared Algorithms Manual');
          expect(titles).toContain('Open Chemistry Handbook');
          expect(titles).not.toContain('Alpha Private Exam Prep');
          expect(titles).not.toContain('Beta Secret Research Notes');
        });

        it('2. should return both shared and restricted books when scope is college', async () => {
          const result = await searchCatalogBooks({ scope: 'college', collegeId: collegeA._id });
          const titles = result.books.map((b) => b.title);

          expect(titles).toContain('Shared Algorithms Manual');
          expect(titles).toContain('Alpha Private Exam Prep');
          expect(titles).not.toContain('Open Chemistry Handbook');
          expect(titles).not.toContain('Beta Secret Research Notes');
        });

        it('3. should correctly filter by search term in public scope', async () => {
          const result = await searchCatalogBooks({ scope: 'public', q: 'Algorithms' });
          expect(result.books.length).toBe(1);
          expect(result.books[0].title).toBe('Shared Algorithms Manual');
        });
      });

      describe('HTTP endpoint behavior: /api/v1/college/:id/books/search', () => {
        it('4. should allow public unauthenticated search via scope=public without leaking restricted items', async () => {
          const res = await request(app).get('/api/v1/college/public/books/search?scope=public');

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const titles = res.body.data.map((b) => b.title);
          expect(titles).toContain('Shared Algorithms Manual');
          expect(titles).toContain('Open Chemistry Handbook');
          expect(titles).not.toContain('Alpha Private Exam Prep');
          expect(titles).not.toContain('Beta Secret Research Notes');
        });

        it('5. should allow authenticated student to search college-scoped catalog', async () => {
          const res = await request(app)
            .get(`/api/v1/college/${collegeA._id}/books/search`)
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const titles = res.body.data.map((b) => b.title);
          expect(titles).toContain('Shared Algorithms Manual');
          expect(titles).toContain('Alpha Private Exam Prep');
          expect(titles).not.toContain('Beta Secret Research Notes');
        });

        it('6. should allow filtering by category in public search', async () => {
          const res = await request(app).get(
            '/api/v1/college/public/books/search?scope=public&category=Chemistry'
          );

          expect(res.status).toBe(200);
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].title).toBe('Open Chemistry Handbook');
        });
      });
    });
  });

  describe('[Source: tagAutocomplete.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_tag_autocomplete_test';
    jest.setTimeout(30000);

    const app = require('../app');
    const Tag = require('../models/Tag');

    describe('GET /api/tags/autocomplete Endpoint', () => {
      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await Tag.deleteMany({});
      });

      afterAll(async () => {
        await Tag.deleteMany({});
        // await // mongoose.connection.close();
      });

      beforeEach(async () => {
        await Tag.deleteMany({});
      });

      it('1. Acceptance Criteria: typing "sci" returns "sci-fi" ranked above a rarely-used tag starting with "sci"', async () => {
        await Tag.create([
          { name: 'Scimitar', slug: 'scimitar', usageCount: 1 },
          { name: 'Sci-Fi', slug: 'sci-fi', usageCount: 150 },
          { name: 'Science', slug: 'science', usageCount: 10 },
          { name: 'History', slug: 'history', usageCount: 50 },
        ]);

        const res = await request(app).get('/api/tags/autocomplete?q=sci');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(3);

        const slugs = res.body.data.map((t) => t.slug);
        expect(slugs).toEqual(['sci-fi', 'science', 'scimitar']);
        expect(slugs).not.toContain('history');
      });

      it('2. should limit returned results to 10 max', async () => {
        const tagsToCreate = [];
        for (let i = 1; i <= 15; i++) {
          tagsToCreate.push({
            name: `Tech Tag ${i}`,
            slug: `tech-tag-${i}`,
            usageCount: i * 5,
          });
        }
        await Tag.create(tagsToCreate);

        const res = await request(app).get('/api/v1/tags/autocomplete?q=tech');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(10);
        expect(res.body.data).toHaveLength(10);
        expect(res.body.data[0].slug).toBe('tech-tag-15'); // Highest usageCount first
      });

      it('3. should handle special regex characters safely without crashing', async () => {
        await Tag.create({ name: 'C++', slug: 'cpp', usageCount: 20 });

        const res = await request(app).get('/api/tags/autocomplete?q=c++(');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('4. should return top overall tags if search query q is empty', async () => {
        await Tag.create([
          { name: 'Popular Tag', slug: 'popular-tag', usageCount: 500 },
          { name: 'Obscure Tag', slug: 'obscure-tag', usageCount: 2 },
        ]);

        const res = await request(app).get('/api/tags/autocomplete');

        expect(res.status).toBe(200);
        expect(res.body.data[0].slug).toBe('popular-tag');
      });
    });
  });

  describe('[Source: tagMigration.test.js]', () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_tagmigration_test';

    jest.setTimeout(30000);

    const mongoose = require('mongoose');
    const connectDB = require('../config/db');
    const Book = require('../models/Book');
    const Tag = require('../models/Tag');
    const College = require('../models/College');
    const { normalizeTag } = require('../utils/tagUtils');
    const path = require('path');
    const migrateTags = require(
      path.resolve(__dirname, '../../../scripts/maintenance/migrateTags')
    );

    describe('Book Tags Normalization & Migration Acceptance Test Suite', () => {
      let testCollege;

      beforeAll(async () => {
        await connectDB();

        testCollege = await College.create({
          name: 'Tag Migration Test College',
          code: `TAG_COLLEGE_${Date.now()}`,
          status: 'active',
        });
      });

      afterAll(async () => {
        try {
          await Book.deleteMany({ collegeId: testCollege._id });
          await Tag.deleteMany({});
          await College.deleteOne({ _id: testCollege._id });
        } catch {
          // Cleanup fallback
        } finally {
          if (mongoose.connection.readyState !== 0) {
            // await // mongoose.connection.close();
          }
        }
      });

      test('Unit Test: normalizeTag utility cleans raw inputs and generates valid slugs', () => {
        expect(normalizeTag(' Computer Science!! ')).toEqual({
          slug: 'computer-science',
          name: 'Computer Science!!',
        });

        expect(normalizeTag('c++')).toEqual({
          slug: 'cpp',
          name: 'c++',
        });

        expect(normalizeTag('Node.js')).toEqual({
          slug: 'nodejs',
          name: 'Node.js',
        });

        expect(normalizeTag('')).toBeNull();
        expect(normalizeTag(null)).toBeNull();
      });

      test('Migration Script Acceptance: produces zero duplicate Tag.slug values and every Book.tags entry resolves to an existing Tag document', async () => {
        // 1. Seed Books with raw free-text tags (including duplicates, mixed casing, extra spaces)
        const book1 = await Book.create({
          collegeId: testCollege._id,
          title: 'Structure and Interpretation of Computer Programs',
          author: 'Harold Abelson',
          category: 'Computer Science',
          isbn: '9780262510875',
          tags: [' Computer Science  ', 'SOFTWARE ENGINEERING', 'c++'],
        });

        const book2 = await Book.create({
          collegeId: testCollege._id,
          title: 'Clean Code',
          author: 'Robert C. Martin',
          category: 'Software Engineering',
          isbn: '9780132350884',
          tags: ['software engineering', 'Computer Science', 'Best Practices'],
        });

        // 2. Execute migration script
        const result = await migrateTags({ quiet: true });
        expect(result.booksUpdated).toBeGreaterThanOrEqual(2);

        // 3. Acceptance Criterion A: Zero duplicate Tag.slug values
        const allTags = await Tag.find({});
        const slugs = allTags.map((t) => t.slug);
        const uniqueSlugs = new Set(slugs);

        expect(allTags.length).toBe(uniqueSlugs.size);

        // 4. Acceptance Criterion B: Every Book.tags entry resolves to an existing Tag document
        const reloadedBooks = await Book.find({ _id: { $in: [book1._id, book2._id] } });
        for (const b of reloadedBooks) {
          expect(b.tags.length).toBeGreaterThan(0);
          for (const tagSlug of b.tags) {
            const matchingTagDoc = await Tag.findOne({ slug: tagSlug });
            expect(matchingTagDoc).not.toBeNull();
            expect(matchingTagDoc.slug).toBe(tagSlug);
          }
        }

        // Verify usageCount stats
        const csTag = await Tag.findOne({ slug: 'computer-science' });
        expect(csTag).not.toBeNull();
        expect(csTag.usageCount).toBe(2); // Injected in both books
      });
    });
  });

  describe('[Source: library.test.js]', () => {
    // Operational tests verifying circulation lifecycle, renewals, queues, and race conditions.
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_library_test';
    process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';
    process.env.JWT_REFRESH_SECRET = 'testjwtlibraryrefreshsecretkey999';
    process.env.JWT_ACCESS_EXPIRY = '10m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    // raised from default 30s: multi-step integration test, verified slow under coverage instrumentation only, see 2026-07-15 audit
    jest.setTimeout(90000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Loan = require('../models/Loan');
    const Reservation = require('../models/Reservation');
    const Fine = require('../models/Fine');
    const { generateTokenPair } = require('../utils/token');

    describe('Library Circulation & Concurrency API Integration Tests', () => {
      let collegeA;
      let collegeB;
      let adminA;
      let adminB;
      let studentA;
      let studentB;
      let bookA;
      let bookB;
      let tokenAdminA;
      let tokenAdminB;
      let tokenStudentA;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Loan.deleteMany({});
        await Reservation.deleteMany({});
        await Fine.deleteMany({});

        // Seed Colleges
        collegeA = await College.create({ name: 'Library College A', code: 'LCA' });
        collegeB = await College.create({ name: 'Library College B', code: 'LCB' });

        // Seed Admins
        adminA = await User.create({
          studentId: 'ADM_A_001',
          name: 'Admin A',
          email: 'admin.a@test.com',
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeA._id,
        });

        adminB = await User.create({
          studentId: 'ADM_B_002',
          name: 'Admin B',
          email: 'admin.b@test.com',
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeB._id,
        });

        // Seed Students
        studentA = await User.create({
          studentId: 'STU_A_001',
          name: 'Student A',
          email: 'student.a@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });

        studentB = await User.create({
          studentId: 'STU_B_002',
          name: 'Student B',
          email: 'student.b@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id,
        });

        // Seed Books
        bookA = await Book.create({
          collegeId: collegeA._id,
          isbn: '978-1111111111',
          title: 'College A Book',
          author: 'Author A',
          category: 'Science',
          copiesTotal: 2,
          copiesAvailable: 2,
        });

        bookB = await Book.create({
          collegeId: collegeB._id,
          isbn: '978-2222222222',
          title: 'College B Book',
          author: 'Author B',
          category: 'Math',
          copiesTotal: 1,
          copiesAvailable: 1,
        });

        // Generate JWTs
        tokenAdminA = generateTokenPair(adminA).accessToken;
        tokenAdminB = generateTokenPair(adminB).accessToken;
        tokenStudentA = generateTokenPair(studentA).accessToken;
      });

      afterAll(async () => {
        await mongoose.connection.db.dropDatabase();
        // await // mongoose.connection.close();
      });

      // Assertion 1: Full lifecycle: checkout -> due date correctly set -> renew (count increments, dueDate extends) -> return (copiesAvailable increments back)
      it('1. should complete the full checkout -> renew -> return lifecycle successfully', async () => {
        expect(bookB.title).toBe('College B Book');
        expect(tokenAdminB).toBeDefined();

        // 1. Checkout
        const checkoutRes = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/checkout')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({
            userId: studentA._id.toString(),
            bookId: bookA._id.toString(),
          });

        expect(checkoutRes.status).toBe(201);
        expect(checkoutRes.body.success).toBe(true);
        const loan = checkoutRes.body.data;
        expect(loan.status).toBe('active');
        expect(loan.dueDate).toBeDefined();

        // Verify copies decremented
        const bookAfterCheckout = await Book.findById(bookA._id);
        expect(bookAfterCheckout.copiesAvailable).toBe(1);

        // 2. Renew
        const renewRes = await request(app)
          .post(`/api/v1/dashboards/student/loans/${loan._id}/renew`)
          .set('Authorization', `Bearer ${tokenStudentA}`);

        expect(renewRes.status).toBe(200);
        expect(renewRes.body.success).toBe(true);
        expect(renewRes.body.data.renewalCount).toBe(1);
        expect(new Date(renewRes.body.data.dueDate).getTime()).toBeGreaterThan(
          new Date(loan.dueDate).getTime()
        );

        // 3. Return
        const returnRes = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/return')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({
            loanId: loan._id.toString(),
          });

        expect(returnRes.status).toBe(200);
        expect(returnRes.body.success).toBe(true);
        expect(returnRes.body.data.status).toBe('returned');

        // Verify copies incremented back
        const bookAfterReturn = await Book.findById(bookA._id);
        expect(bookAfterReturn.copiesAvailable).toBe(2);
      });

      // Assertion 2: Renewal rejected once maxRenewals is hit
      it('2. should reject renewal once maxRenewals is hit', async () => {
        // Checkout again
        const checkoutRes = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/checkout')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({
            userId: studentA._id.toString(),
            bookId: bookA._id.toString(),
          });

        const loanId = checkoutRes.body.data._id;

        // Renew 1st time
        await request(app)
          .post(`/api/v1/dashboards/student/loans/${loanId}/renew`)
          .set('Authorization', `Bearer ${tokenStudentA}`);

        // Renew 2nd time (hits maxLimit of 2)
        await request(app)
          .post(`/api/v1/dashboards/student/loans/${loanId}/renew`)
          .set('Authorization', `Bearer ${tokenStudentA}`);

        // Renew 3rd time (must reject)
        const renewRes3 = await request(app)
          .post(`/api/v1/dashboards/student/loans/${loanId}/renew`)
          .set('Authorization', `Bearer ${tokenStudentA}`);

        expect(renewRes3.status).toBe(400);
        expect(renewRes3.body.message).toContain('Maximum renewals reached');

        // Clean return for next tests
        await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/return')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({ loanId });
      });

      // Assertion 3: Renewal rejected when a reservation queue exists for that book
      it('3. should reject renewal when a reservation queue exists for that book', async () => {
        // Make book copiesAvailable = 0 (total copies = 2)
        // 1st checkout
        const checkoutRes1 = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/checkout')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({
            userId: studentA._id.toString(),
            bookId: bookA._id.toString(),
          });

        // 2nd checkout
        const tempStudent = await User.create({
          studentId: 'STU_A_TEMP',
          name: 'Temp Student',
          email: 'temp@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });
        const tokenTempStudent = generateTokenPair(tempStudent).accessToken;

        const checkoutRes2 = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/checkout')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({
            userId: tempStudent._id.toString(),
            bookId: bookA._id.toString(),
          });

        // Verify copies are now 0
        const bookCheck = await Book.findById(bookA._id);
        expect(bookCheck.copiesAvailable).toBe(0);

        // Place a hold to create a queue
        const holdRes = await request(app)
          .post('/api/v1/dashboards/student/reservations')
          .set('Authorization', `Bearer ${tokenTempStudent}`)
          .send({ bookId: bookA._id.toString() });

        expect(holdRes.status).toBe(201);

        // Attempt renewal on checkoutRes1 (must reject because queue exists)
        const renewRes = await request(app)
          .post(`/api/v1/dashboards/student/loans/${checkoutRes1.body.data._id}/renew`)
          .set('Authorization', `Bearer ${tokenStudentA}`);

        expect(renewRes.status).toBe(400);
        expect(renewRes.body.message).toContain('Other users are waiting in the queue');

        // Clean up loans
        await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/return')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({ loanId: checkoutRes1.body.data._id });

        await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/return')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({ loanId: checkoutRes2.body.data._id });
      });

      // Assertion 4: THE RACE CONDITION TEST: simulate concurrent checkouts
      it('4. should successfully isolate concurrent checkouts to prevent negative copiesAvailable', async () => {
        // 1. Set book copiesAvailable = 1
        const singleCopyBook = await Book.create({
          collegeId: collegeA._id,
          isbn: '978-3333333333',
          title: 'Race Condition Book',
          author: 'Author C',
          category: 'Science',
          copiesTotal: 1,
          copiesAvailable: 1,
        });

        // Create another test student
        const studentC = await User.create({
          studentId: 'STU_A_003',
          name: 'Student C',
          email: 'student.c@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });

        // Firing concurrent checkouts (Promise.all)
        const [res1, res2] = await Promise.all([
          request(app)
            .post('/api/v1/dashboards/college-admin/circulation/checkout')
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              userId: studentA._id.toString(),
              bookId: singleCopyBook._id.toString(),
            }),
          request(app)
            .post('/api/v1/dashboards/college-admin/circulation/checkout')
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              userId: studentC._id.toString(),
              bookId: singleCopyBook._id.toString(),
            }),
        ]);

        // Assert that exactly one checkout succeeded (201) and one failed (400)
        const statusCodes = [res1.status, res2.status];
        expect(statusCodes).toContain(201);
        expect(statusCodes).toContain(400);

        // Verify copiesAvailable is exactly 0 and NOT -1
        const updatedBook = await Book.findById(singleCopyBook._id);
        expect(updatedBook.copiesAvailable).toBe(0);
      });

      // Assertion 5: Hold placement rejected if copies are actually available
      it('5. should reject hold placement if copies are available', async () => {
        const res = await request(app)
          .post('/api/v1/dashboards/student/reservations')
          .set('Authorization', `Bearer ${tokenStudentA}`)
          .send({ bookId: bookA._id.toString() });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('Book is currently available');
      });

      // Assertion 6: Return of a book with an active queue correctly promotes the front of the queue to ready_for_pickup
      it('6. should promote front of reservation queue to ready_for_pickup upon return', async () => {
        const queueBook = await Book.create({
          collegeId: collegeA._id,
          isbn: '978-4444444444',
          title: 'Queue Book',
          author: 'Author D',
          category: 'Science',
          copiesTotal: 1,
          copiesAvailable: 0,
        });

        // Create loan
        const loan = await Loan.create({
          collegeId: collegeA._id,
          userId: studentA._id,
          bookId: queueBook._id,
          dueDate: new Date(),
          maxRenewals: 2,
          issuedBy: adminA._id,
        });

        // Create reservation hold
        const hold = await Reservation.create({
          collegeId: collegeA._id,
          userId: studentB._id, // Student B is waiting
          bookId: queueBook._id,
          queuePosition: 1,
          status: 'queued',
        });

        // Return the book
        const returnRes = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/return')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({ loanId: loan._id.toString() });

        expect(returnRes.status).toBe(200);

        // Verify that Student B's hold is now 'ready_for_pickup' and has a 'readyAt' time
        const updatedHold = await Reservation.findById(hold._id);
        expect(updatedHold.status).toBe('ready_for_pickup');
        expect(updatedHold.readyAt).toBeDefined();
      });

      // Assertion 7: Cross-tenant checkout attempt rejected
      it('7. should reject cross-tenant checkout attempt (admin LCA, student LCB)', async () => {
        const res = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/checkout')
          .set('Authorization', `Bearer ${tokenAdminA}`) // LCA admin
          .send({
            userId: studentB._id.toString(), // LCB student
            bookId: bookA._id.toString(),
          });

        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Cross-tenant checkout rejected');
      });

      // Assertion 8: Student cannot access college-admin circulation routes (403)
      it('8. should block student from accessing admin circulation endpoints', async () => {
        const res = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/checkout')
          .set('Authorization', `Bearer ${tokenStudentA}`)
          .send({
            userId: studentA._id.toString(),
            bookId: bookA._id.toString(),
          });

        expect(res.status).toBe(403);
      });
    });
  });
});
