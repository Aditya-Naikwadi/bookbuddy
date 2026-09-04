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
const migrateTags = require(path.resolve(__dirname, '../../../scripts/migrateTags'));

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
        await mongoose.connection.close();
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
