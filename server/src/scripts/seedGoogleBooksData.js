const mongoose = require('mongoose');
require('dotenv').config();

const googleBooksService = require('../services/googleBooksService');
const Book = require('../models/Book');
const College = require('../models/College');

const TOPICS = [
  'Computer Science',
  'Artificial Intelligence',
  'Physics',
  'Mathematics',
  'Biology',
  'Data Science',
  'Software Engineering',
  'Machine Learning',
  'Cybersecurity',
  'Economics',
];

async function seedGoogleBooksData() {
  console.log('[Google Books Seeder] Connecting to MongoDB...');
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy';
  await mongoose.connect(mongoUri);

  console.log('[Google Books Seeder] Successfully connected to database.');

  let college = await College.findOne({});
  if (!college) {
    console.log(
      '[Google Books Seeder] No existing college found. Creating default college context...'
    );
    college = await College.create({
      name: 'Default Engineering College',
      code: 'DEC01',
      domain: 'engineering.edu',
    });
  }

  console.log(`[Google Books Seeder] Target College ID: ${college._id}`);
  console.log('[Google Books Seeder] Querying Google Books API with API key...');

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const topic of TOPICS) {
    console.log(`[Google Books Seeder] Fetching books for topic "${topic}"...`);
    try {
      const { books } = await googleBooksService.searchBooks({ search: topic, limit: 10 });

      for (const b of books) {
        const existing = await Book.findOne({
          $or: [{ isbn: b.isbn }, { title: b.title, author: b.author }],
        });

        if (!existing) {
          await Book.create({
            collegeId: college._id,
            isbn: b.isbn,
            title: b.title,
            author: b.author,
            category: b.category || topic,
            format: 'digital',
            copiesTotal: 5,
            copiesAvailable: 5,
            shelfLocation: `Digital Shelf / Google Books (${topic})`,
          });
          totalInserted++;
          console.log(`  + Inserted: "${b.title}" by ${b.author}`);
        } else {
          totalSkipped++;
        }
      }
    } catch (err) {
      console.error(`[Google Books Seeder] Failed to fetch topic "${topic}":`, err.message);
    }
  }

  console.log('\n[Google Books Seeder] Complete!');
  console.log(`- New Books Inserted: ${totalInserted}`);
  console.log(`- Existing Books Skipped: ${totalSkipped}`);

  await mongoose.disconnect();
  console.log('[Google Books Seeder] MongoDB disconnected.');
}

if (require.main === module) {
  seedGoogleBooksData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Google Books Seeder] Fatal Error:', err);
      process.exit(1);
    });
}

module.exports = seedGoogleBooksData;
