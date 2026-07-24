const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Announcement = require('../models/Announcement');
const LibrarySettings = require('../models/LibrarySettings');
const Book = require('../models/Book');
const EResource = require('../models/EResource');

const purgeMockData = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookbuddy';
    console.log(`[Purge Script] Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    console.log('--- PURGING ALL PREDEFINED AND MOCK DATA FROM MONGODB ---');

    // 1. Purge Announcements
    const announcementsRes = await Announcement.deleteMany({});
    console.log(`  ✓ Purged Announcements: ${announcementsRes.deletedCount} documents removed.`);

    // 2. Purge Library Settings
    const librarySettingsRes = await LibrarySettings.deleteMany({});
    console.log(
      `  ✓ Purged LibrarySettings: ${librarySettingsRes.deletedCount} documents removed.`
    );

    // 3. Purge Mock Catalog Books (titles matching mock seeds)
    const mockTitles = [
      'Principles of Modern Architecture & Urban Planning',
      'Data Structures and Algorithms in Python',
      'Global Economic Trends & Financial Markets',
      'Biochemistry & Molecular Biology Essentials',
      'History of World Literature: Antiquity to Modernity',
      'Quantum Computing Principles & Mathematical Models',
      'Environmental Science & Climate Resiliency',
      'Organic Chemistry Laboratory Handbook',
    ];
    const booksRes = await Book.deleteMany({ title: { $in: mockTitles } });
    console.log(`  ✓ Purged Mock Books: ${booksRes.deletedCount} documents removed.`);

    // 4. Purge Mock E-Resources
    const mockEResources = [
      'History of Local Architecture & Campus Planning',
      'Journal of Sustainable Energy & Environmental Engineering',
      'Computer Science Past Examination Papers (2018 - 2024)',
      'Global Economic Data & Financial Indicator Database',
      'Classical Literature & World Philosophy Reader',
    ];
    const eresourcesRes = await EResource.deleteMany({ title: { $in: mockEResources } });
    console.log(`  ✓ Purged Mock E-Resources: ${eresourcesRes.deletedCount} documents removed.`);

    console.log('--- MONGODB PURGE COMPLETE! All mock data successfully removed. ---');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Purge Error] Failed to purge mock data from MongoDB:', error);
    process.exit(1);
  }
};

purgeMockData();
