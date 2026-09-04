const fs = require('fs');
const path = require('path');
const serverDir = fs.existsSync(path.join(__dirname, '../../backend'))
  ? path.join(__dirname, '../../backend')
  : path.join(__dirname, '../server');

let dotenv;
try {
  dotenv = require('dotenv');
} catch (_err) {
  try {
    dotenv = require(path.join(serverDir, 'node_modules/dotenv'));
  } catch (_e) {
    // Optional fallback if dotenv is absent
  }
}
if (dotenv && typeof dotenv.config === 'function') {
  dotenv.config({ path: path.join(serverDir, '.env') });
}

let mongoose;
try {
  mongoose = require('mongoose');
} catch (_err) {
  mongoose = require(path.join(serverDir, 'node_modules/mongoose'));
}

const connectDB = require(path.join(serverDir, 'src/config/db'));
const Book = require(path.join(serverDir, 'src/models/Book'));
const Tag = require(path.join(serverDir, 'src/models/Tag'));
const { normalizeTag } = require(path.join(serverDir, 'src/utils/tagUtils'));

const migrateTags = async (options = { quiet: false }) => {
  const log = (...args) => {
    if (!options.quiet) {
      console.log(...args);
    }
  };

  log('Starting Tag Migration Process...');

  // 1. Fetch all books from DB with skipTenantScope option
  const books = await Book.find({}, null, { skipTenantScope: true });
  log(`Found ${books.length} total books to process.`);

  let updatedBooksCount = 0;
  let totalTagsProcessed = 0;
  const tagCountMap = new Map(); // slug -> { name, count }

  for (const book of books) {
    if (!book.tags || book.tags.length === 0) continue;

    const normalizedSlugs = [];
    for (const rawTag of book.tags) {
      const normalized = normalizeTag(rawTag);
      if (!normalized || !normalized.slug) continue;

      totalTagsProcessed++;
      const { slug, name } = normalized;

      if (!normalizedSlugs.includes(slug)) {
        normalizedSlugs.push(slug);
      }

      if (!tagCountMap.has(slug)) {
        tagCountMap.set(slug, { name, count: 1 });
      } else {
        const existing = tagCountMap.get(slug);
        tagCountMap.set(slug, { name, count: existing.count + 1 });
      }
    }

    // Rewrite Book.tags array to normalized slug array
    book.tags = normalizedSlugs;
    await book.save({ skipTenantScope: true });
    updatedBooksCount++;
  }

  log(`Upserting ${tagCountMap.size} unique normalized tags into Tag collection...`);

  // 2. Upsert unique tags into Tag collection & update usageCount
  for (const [slug, { name, count }] of tagCountMap.entries()) {
    await Tag.findOneAndUpdate(
      { slug },
      {
        $setOnInsert: { slug, name },
        $inc: { usageCount: count },
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  log(`Migration Complete:`);
  log(`  - Books Updated: ${updatedBooksCount}`);
  log(`  - Total Free-Text Tags Processed: ${totalTagsProcessed}`);
  log(`  - Unique Tag Documents Upserted: ${tagCountMap.size}`);

  return {
    booksProcessed: books.length,
    booksUpdated: updatedBooksCount,
    totalTagsProcessed,
    uniqueTagsCount: tagCountMap.size,
  };
};

// If run directly from CLI
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await migrateTags();
      process.exit(0);
    } catch (err) {
      console.error('Error running migrateTags script:', err);
      process.exit(1);
    }
  })();
}

module.exports = migrateTags;
