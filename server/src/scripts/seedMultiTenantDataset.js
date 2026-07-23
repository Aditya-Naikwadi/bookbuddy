const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import authoritative models
const College = require('../models/College');
const User = require('../models/User');
const Book = require('../models/Book');
const connectDB = require('../config/db');

const seedMultiTenantDataset = async () => {
  try {
    console.log('⚡ Connecting to MongoDB Database...');
    await connectDB();

    console.log('🧹 Cleaning existing Colleges, Users, and Books...');
    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});

    // Generate shared dummy password hash (Password: "Demo@123")
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Demo@123', salt);
    const superAdminPassword = await bcrypt.hash('superadmin', salt);

    // ----------------------------------------------------
    // STEP 1: Generate Colleges (Multi-Tenant Organizations)
    // ----------------------------------------------------
    console.log('🏫 Seeding 3 Multi-Tenant College Campuses...');
    const collegeDocs = await College.insertMany([
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Tech University',
        code: 'TECH_UNIV',
        maxFineLimit: 100,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Liberal Arts College',
        code: 'LIB_ARTS',
        maxFineLimit: 150,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Metropolitan State University',
        code: 'METRO_STATE',
        maxFineLimit: 120,
      },
    ]);

    const techCollege = collegeDocs[0];
    const artsCollege = collegeDocs[1];
    const metroCollege = collegeDocs[2];

    // ----------------------------------------------------
    // STEP 2: Generate Dummy Books (for savedBookmarks references)
    // ----------------------------------------------------
    console.log('📚 Seeding Catalog Books for Bookmark references...');
    const bookDocs = await Book.insertMany([
      {
        _id: new mongoose.Types.ObjectId(),
        collegeId: techCollege._id,
        title: 'Structure and Interpretation of Computer Programs',
        author: 'Harold Abelson, Gerald Jay Sussman',
        isbn: '978-0262510875',
        category: 'Computer Science',
        copiesTotal: 5,
        copiesAvailable: 5,
        shelfLocation: 'Rack CS-101',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        collegeId: techCollege._id,
        title: 'Deep Learning',
        author: 'Ian Goodfellow, Yoshua Bengio',
        isbn: '978-0262035613',
        category: 'Artificial Intelligence',
        copiesTotal: 4,
        copiesAvailable: 3,
        shelfLocation: 'Rack AI-202',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        collegeId: artsCollege._id,
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        isbn: '978-0743273565',
        category: 'Literature',
        copiesTotal: 10,
        copiesAvailable: 8,
        shelfLocation: 'Rack LIT-05',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        collegeId: metroCollege._id,
        title: 'Principles of Neural Science',
        author: 'Eric Kandel',
        isbn: '978-0071390118',
        category: 'Biomedical',
        copiesTotal: 3,
        copiesAvailable: 2,
        shelfLocation: 'Rack MED-12',
      },
    ]);

    // ----------------------------------------------------
    // STEP 3: Assemble User Dataset according to Role Rules
    // ----------------------------------------------------
    console.log('👥 Generating Users for Super Admin, College Admins, Students & General Users...');

    const validTillDate = new Date();
    validTillDate.setFullYear(validTillDate.getFullYear() + 4);

    const userPayloads = [
      // --------------------------------------------------
      // ROLE 1: SUPER ADMIN (Exactly 1, NO collegeId)
      // --------------------------------------------------
      {
        studentId: 'SA_001',
        name: 'Super Admin',
        email: 'SuperAdmin@bookbuddy.com',
        password: superAdminPassword,
        role: 'super-admin',
        // collegeId is intentionally undefined for Super Admin
        isActive: true,
        membershipStatus: 'active',
        validTill: validTillDate,
      },

      // --------------------------------------------------
      // ROLE 2: COLLEGE ADMINS (1-2 per College, MUST have collegeId)
      // --------------------------------------------------
      // Tech University Admins
      {
        studentId: 'COL_ADM_101',
        name: 'Dr. Marcus Sterling',
        email: 'marcus.sterling@techuniv.edu',
        password: hashedPassword,
        role: 'college-admin',
        collegeId: techCollege._id,
        isActive: true,
        membershipStatus: 'active',
        validTill: validTillDate,
      },
      {
        studentId: 'COL_ADM_102',
        name: 'Dr. Helen Vance',
        email: 'helen.vance@techuniv.edu',
        password: hashedPassword,
        role: 'college-admin',
        collegeId: techCollege._id,
        isActive: true,
        membershipStatus: 'active',
        validTill: validTillDate,
      },
      // Liberal Arts Admin
      {
        studentId: 'COL_ADM_201',
        name: 'Prof. Robert Langdon',
        email: 'robert.langdon@liberalarts.edu',
        password: hashedPassword,
        role: 'college-admin',
        collegeId: artsCollege._id,
        isActive: true,
        membershipStatus: 'active',
        validTill: validTillDate,
      },
      // Metro State Admin
      {
        studentId: 'COL_ADM_301',
        name: 'Dr. Sarah Jenkins',
        email: 'sarah.jenkins@metrostate.edu',
        password: hashedPassword,
        role: 'college-admin',
        collegeId: metroCollege._id,
        isActive: true,
        membershipStatus: 'active',
        validTill: validTillDate,
      },

      // --------------------------------------------------
      // ROLE 3: STUDENTS (3-5 per College, MUST have collegeId, major, savedBookmarks, searchHistory)
      // --------------------------------------------------
      // Tech University Students
      {
        studentId: 'STU_101',
        name: 'Alice Johnson',
        email: 'alice.johnson@techuniv.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: techCollege._id,
        major: 'Computer Science',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [bookDocs[0]._id, bookDocs[1]._id],
        searchHistory: [
          {
            query: 'Algorithms and Data Structures',
            timestamp: new Date(Date.now() - 86400000 * 2),
          },
          { query: 'Machine Learning Fundamentals', timestamp: new Date(Date.now() - 3600000 * 4) },
        ],
      },
      {
        studentId: 'STU_102',
        name: 'Bob Smith',
        email: 'bob.smith@techuniv.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: techCollege._id,
        major: 'Artificial Intelligence',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [bookDocs[1]._id],
        searchHistory: [
          { query: 'Neural Networks', timestamp: new Date(Date.now() - 86400000 * 5) },
        ],
      },
      {
        studentId: 'STU_103',
        name: 'Charlie Davis',
        email: 'charlie.davis@techuniv.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: techCollege._id,
        major: 'Cybersecurity',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [bookDocs[0]._id],
        searchHistory: [
          { query: 'Cryptography basics', timestamp: new Date(Date.now() - 86400000) },
        ],
      },
      {
        studentId: 'STU_104',
        name: 'Diana Prince',
        email: 'diana.prince@techuniv.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: techCollege._id,
        major: 'Software Engineering',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [],
        searchHistory: [{ query: 'Clean Architecture', timestamp: new Date() }],
      },

      // Liberal Arts College Students
      {
        studentId: 'STU_201',
        name: 'Edward Nygma',
        email: 'edward.nygma@liberalarts.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: artsCollege._id,
        major: 'English Literature',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [bookDocs[2]._id],
        searchHistory: [
          { query: 'Modern American Poetry', timestamp: new Date(Date.now() - 86400000 * 3) },
        ],
      },
      {
        studentId: 'STU_202',
        name: 'Fiona Gallagher',
        email: 'fiona.g@liberalarts.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: artsCollege._id,
        major: 'Philosophy',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [bookDocs[2]._id],
        searchHistory: [
          { query: 'Ethics and Moral Philosophy', timestamp: new Date(Date.now() - 43200000) },
        ],
      },
      {
        studentId: 'STU_203',
        name: 'George Wright',
        email: 'george.w@liberalarts.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: artsCollege._id,
        major: 'History',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [],
        searchHistory: [
          { query: '20th Century World History', timestamp: new Date(Date.now() - 86400000 * 7) },
        ],
      },

      // Metropolitan State Students
      {
        studentId: 'STU_301',
        name: 'Hannah Abbott',
        email: 'hannah.a@metrostate.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: metroCollege._id,
        major: 'Biomedical Science',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [bookDocs[3]._id],
        searchHistory: [
          { query: 'Neuroscience and Physiology', timestamp: new Date(Date.now() - 86400000 * 2) },
        ],
      },
      {
        studentId: 'STU_302',
        name: 'Ian Malcolm',
        email: 'ian.malcolm@metrostate.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: metroCollege._id,
        major: 'Mathematics',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [],
        searchHistory: [{ query: 'Chaos Theory and Nonlinear Dynamics', timestamp: new Date() }],
      },
      {
        studentId: 'STU_303',
        name: 'Julia Roberts',
        email: 'julia.r@metrostate.edu',
        password: hashedPassword,
        role: 'student',
        collegeId: metroCollege._id,
        major: 'Data Analytics',
        membershipStatus: 'active',
        validTill: validTillDate,
        savedBookmarks: [bookDocs[3]._id],
        searchHistory: [
          { query: 'Statistical Inference', timestamp: new Date(Date.now() - 3600000 * 12) },
        ],
      },

      // --------------------------------------------------
      // ROLE 4: GENERAL USERS (2-3 per College, MUST have collegeId)
      // --------------------------------------------------
      // Tech University General Users
      {
        studentId: 'GEN_101',
        name: 'Kevin Bacon',
        email: 'kevin.bacon@techuniv.edu',
        password: hashedPassword,
        role: 'general',
        collegeId: techCollege._id,
        membershipStatus: 'active',
        validTill: validTillDate,
      },
      {
        studentId: 'GEN_102',
        name: 'Laura Palmer',
        email: 'laura.palmer@techuniv.edu',
        password: hashedPassword,
        role: 'general',
        collegeId: techCollege._id,
        membershipStatus: 'active',
        validTill: validTillDate,
      },

      // Liberal Arts General Users
      {
        studentId: 'GEN_201',
        name: 'Michael Scott',
        email: 'michael.scott@liberalarts.edu',
        password: hashedPassword,
        role: 'general',
        collegeId: artsCollege._id,
        membershipStatus: 'active',
        validTill: validTillDate,
      },
      {
        studentId: 'GEN_202',
        name: 'Nancy Wheeler',
        email: 'nancy.w@liberalarts.edu',
        password: hashedPassword,
        role: 'general',
        collegeId: artsCollege._id,
        membershipStatus: 'active',
        validTill: validTillDate,
      },

      // Metro State General Users
      {
        studentId: 'GEN_301',
        name: 'Oscar Martinez',
        email: 'oscar.m@metrostate.edu',
        password: hashedPassword,
        role: 'general',
        collegeId: metroCollege._id,
        membershipStatus: 'active',
        validTill: validTillDate,
      },
      {
        studentId: 'GEN_302',
        name: 'Pam Beesly',
        email: 'pam.b@metrostate.edu',
        password: hashedPassword,
        role: 'general',
        collegeId: metroCollege._id,
        membershipStatus: 'active',
        validTill: validTillDate,
      },
    ];

    console.log(
      `💾 Inserting ${userPayloads.length} User documents into MongoDB via User.insertMany()...`
    );
    const createdUsers = await User.insertMany(userPayloads);

    // ----------------------------------------------------
    // STEP 4: Print Seeding Report Summary
    // ----------------------------------------------------
    console.log('\n======================================================');
    console.log('✅ MULTI-TENANT DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log(`🏫 Colleges Created:        ${collegeDocs.length}`);
    console.log(`📚 Books Created:           ${bookDocs.length}`);
    console.log(`👥 Total Users Created:     ${createdUsers.length}`);
    console.log(`   ├─ Super Admin:          1  (No collegeId)`);
    console.log(`   ├─ College Admins:       4  (4 across 3 colleges)`);
    console.log(`   ├─ Students:             10 (with majors, bookmarks & search logs)`);
    console.log(`   └─ General Users:        6  (2 per college)`);
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error Failed:', error);
    process.exit(1);
  }
};

seedMultiTenantDataset();
