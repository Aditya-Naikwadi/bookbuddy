const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Announcement = require('../models/Announcement');
const LibrarySettings = require('../models/LibrarySettings');
const Book = require('../models/Book');
const College = require('../models/College');

const seedGeneralDashboard = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookbuddy';
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    console.log('--- Seeding General Dashboard MongoDB Data ---');

    // 1. Find or create a default college
    let college = await College.findOne();
    if (!college) {
      college = await College.create({
        name: 'Apex Institute of Technology & Science',
        code: 'AITS-MAIN',
        selectedServices: ['catalog_management', 'facilities_booking'],
        enabledFeatures: ['catalog_management', 'facilities_booking'],
      });
      console.log(`Created default College: ${college.name} (${college._id})`);
    }

    // 2. Seed Library Settings
    await LibrarySettings.findOneAndUpdate(
      { collegeId: college._id },
      {
        collegeId: college._id,
        openingHour: '08:00 AM',
        closingHour: '10:00 PM',
        timezone: 'UTC',
        isClosedToday: false,
        monthlyGrowthGoal: 140,
      },
      { upsert: true, new: true }
    );
    console.log('✓ Seeded LibrarySettings collection.');

    // 3. Seed Announcements
    const announcementCount = await Announcement.countDocuments();
    if (announcementCount === 0) {
      await Announcement.insertMany([
        {
          collegeId: college._id,
          title: 'Midterm Extended Library Hours',
          content: 'The main reading hall will remain open until 11:30 PM throughout examination week.',
          priority: 'Notice',
          category: 'Operational',
          isActive: true,
        },
        {
          collegeId: college._id,
          title: 'Scheduled Network Maintenance',
          content: 'Wi-Fi services in Section B will undergo scheduled maintenance on Friday 2-4 PM.',
          priority: 'Warning',
          category: 'Maintenance',
          isActive: true,
        },
        {
          collegeId: college._id,
          title: 'Urgent: Reserve Desk Relocation',
          content: 'All course reserve pick-ups have temporarily moved to Desk 2 near North Entrance.',
          priority: 'Urgent',
          category: 'Operational',
          isActive: true,
        },
      ]);
      console.log('✓ Seeded 3 Announcement records.');
    } else {
      console.log(`✓ Announcement collection already contains ${announcementCount} records.`);
    }

    // 4. Seed Sample Catalog Books across Categories
    // const bookCount = await Book.countDocuments();
    // if (bookCount === 0) {
    //   await Book.insertMany([
    //     {
    //       collegeId: college._id,
    //       isbn: '978-0134685991',
    //       title: 'Principles of Modern Architecture & Urban Planning',
    //       author: 'Elena Rostova',
    //       genre: 'Architecture',
    //       publicationYear: 2024,
    //       format: 'Hardcover',
    //       totalCopies: 5,
    //       copiesAvailable: 4,
    //       shelfLocation: 'Floor 2, Shelf A-14',
    //       description: 'A comprehensive study of contemporary sustainable building design.',
    //     },
    //     {
    //       collegeId: college._id,
    //       isbn: '978-0134093413',
    //       title: 'Data Structures and Algorithms in Python',
    //       author: 'Dr. Alan Turing Jr.',
    //       genre: 'Computer Science',
    //       publicationYear: 2023,
    //       format: 'Paperback',
    //       totalCopies: 6,
    //       copiesAvailable: 2,
    //       shelfLocation: 'Floor 3, Shelf CS-08',
    //       description: 'Essential algorithmic patterns and dynamic programming.',
    //     },
    //     {
    //       collegeId: college._id,
    //       isbn: '978-0078021800',
    //       title: 'Global Economic Trends & Financial Markets',
    //       author: 'Marcus Vance',
    //       genre: 'Economics',
    //       publicationYear: 2024,
    //       format: 'Hardcover',
    //       totalCopies: 3,
    //       copiesAvailable: 0,
    //       shelfLocation: 'Floor 1, Shelf EC-02',
    //       description: 'Analysis of global trade patterns and fiscal policy.',
    //     },
    //     {
    //       collegeId: college._id,
    //       isbn: '978-0321762955',
    //       title: 'Biochemistry & Molecular Biology Essentials',
    //       author: 'Sarah Lin',
    //       genre: 'Biology',
    //       publicationYear: 2023,
    //       format: 'Hardcover',
    //       totalCopies: 5,
    //       copiesAvailable: 5,
    //       shelfLocation: 'Floor 3, Shelf BIO-12',
    //       description: 'Cellular mechanics, genetics, and metabolic processes.',
    //     },
    //     {
    //       collegeId: college._id,
    //       isbn: '978-0140449136',
    //       title: 'History of World Literature: Antiquity to Modernity',
    //       author: 'Clara Oswald',
    //       genre: 'Literature',
    //       publicationYear: 2022,
    //       format: 'Paperback',
    //       totalCopies: 4,
    //       copiesAvailable: 1,
    //       shelfLocation: 'Floor 2, Shelf LIT-05',
    //       description: 'Comparative literature across eastern and western canons.',
    //     },
    //   ]);
    //   console.log('✓ Seeded 5 Book records for General Dashboard display.');
    // } else {
    //   console.log(`✓ Book collection already contains ${bookCount} records.`);
    // }

    console.log('--- Seeding Completed Successfully! ---');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding General Dashboard data:', error);
    process.exit(1);
  }
};

seedGeneralDashboard();
