const mongoose = require('mongoose');
const argon2 = require('argon2');
require('dotenv').config();

const College = require('../models/College');
const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const CollegeFeatureConfig = require('../models/CollegeFeatureConfig');
const { deleteCache } = require('../utils/redisCache');

async function seedProofData() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in environment.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✓ Connected to MongoDB');

  // Password hashes
  const adminHash = await argon2.hash('AdminPass@2026!', { type: argon2.argon2id });
  const studentHash = await argon2.hash('StudentPass@2026!', { type: argon2.argon2id });
  const generalHash = await argon2.hash('GeneralPass@2026!', { type: argon2.argon2id });

  // 1. College A: Standford university
  let collegeA = await College.findOne({ slug: 'standford' });
  if (collegeA) {
    collegeA.status = 'active';
    collegeA.isActive = true;
    collegeA.enabledFeatures = ['catalog', 'loans', 'patron-card'];
    await collegeA.save();
  } else {
    collegeA = await College.create({
      name: 'Standford University',
      shortName: 'Standford',
      code: 'STANDFORD',
      slug: 'standford',
      status: 'active',
      isActive: true,
      enabledFeatures: ['catalog', 'loans', 'patron-card'],
    });
  }

  // 2. College B: Ganesh Vidyalay College
  let collegeB = await College.findOne({ slug: 'edu' });
  if (collegeB) {
    collegeB.status = 'active';
    collegeB.isActive = true;
    collegeB.enabledFeatures = ['catalog', 'loans', 'patron-card'];
    await collegeB.save();
  } else {
    collegeB = await College.create({
      name: 'Ganesh Vidyalay College',
      shortName: 'Ganesh',
      code: 'GAN-VID',
      slug: 'edu',
      status: 'active',
      isActive: true,
      enabledFeatures: ['catalog', 'loans', 'patron-card'],
    });
  }

  // Initialize CollegeFeatureConfig with phased flags OFF
  await CollegeFeatureConfig.findOneAndUpdate(
    { collegeId: collegeA._id },
    { collegeId: collegeA._id, enabledFeatures: ['catalog', 'loans', 'patron-card'] },
    { upsert: true }
  );
  await CollegeFeatureConfig.findOneAndUpdate(
    { collegeId: collegeB._id },
    { collegeId: collegeB._id, enabledFeatures: ['catalog', 'loans', 'patron-card'] },
    { upsert: true }
  );

  await deleteCache(`college:features:${collegeA._id}`);
  await deleteCache(`college:features:${collegeB._id}`);

  // Seed Users
  // Standard Admin & Student
  const adminA = await User.findOneAndUpdate(
    { email: 'admin@standard.edu' },
    {
      collegeId: collegeA._id,
      studentId: 'ADM-STD-001',
      name: 'Standard Admin',
      email: 'admin@standard.edu',
      password: adminHash,
      role: 'college-admin',
      status: 'active',
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  const studentA = await User.findOneAndUpdate(
    { email: 'student@standard.edu' },
    {
      collegeId: collegeA._id,
      studentId: 'STU-STD-001',
      name: 'Standard Student',
      email: 'student@standard.edu',
      password: studentHash,
      role: 'student',
      status: 'active',
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Ganesh Admin & Student
  const adminB = await User.findOneAndUpdate(
    { email: 'admin@ganesh.edu' },
    {
      collegeId: collegeB._id,
      studentId: 'ADM-GAN-001',
      name: 'Ganesh Admin',
      email: 'admin@ganesh.edu',
      password: adminHash,
      role: 'college-admin',
      status: 'active',
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  const studentB = await User.findOneAndUpdate(
    { email: 'student@ganesh.edu' },
    {
      collegeId: collegeB._id,
      studentId: 'STU-GAN-001',
      name: 'Ganesh Student',
      email: 'student@ganesh.edu',
      password: studentHash,
      role: 'student',
      status: 'active',
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  // General Public User
  const generalUser = await User.findOneAndUpdate(
    { email: 'general@bookbuddy.com' },
    {
      name: 'BookBuddy General User',
      email: 'general@bookbuddy.com',
      password: generalHash,
      role: 'general',
      status: 'active',
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Seed Books
  const bookA = await Book.findOneAndUpdate(
    { collegeId: collegeA._id, isbn: '978-0132350884' },
    {
      collegeId: collegeA._id,
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      category: 'Computer Science',
      copiesTotal: 5,
      copiesAvailable: 4,
    },
    { upsert: true, returnDocument: 'after' }
  );

  const bookB = await Book.findOneAndUpdate(
    { collegeId: collegeB._id, isbn: '978-0201616224' },
    {
      collegeId: collegeB._id,
      title: 'The Pragmatic Programmer',
      author: 'Andrew Hunt & David Thomas',
      isbn: '978-0201616224',
      category: 'Computer Science',
      copiesTotal: 8,
      copiesAvailable: 7,
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Seed Loans
  await Loan.findOneAndUpdate(
    { collegeId: collegeA._id, bookId: bookA._id, userId: studentA._id },
    {
      collegeId: collegeA._id,
      bookId: bookA._id,
      userId: studentA._id,
      issuedBy: adminA._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      renewalCount: 0,
      maxRenewals: 2,
      status: 'active',
    },
    { upsert: true, returnDocument: 'after' }
  );

  await Loan.findOneAndUpdate(
    { collegeId: collegeB._id, bookId: bookB._id, userId: studentB._id },
    {
      collegeId: collegeB._id,
      bookId: bookB._id,
      userId: studentB._id,
      issuedBy: adminB._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      renewalCount: 0,
      maxRenewals: 2,
      status: 'active',
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Sync Loan indexes
  await Loan.syncIndexes();

  console.log('✅ Proof data successfully seeded for 2 Colleges & 4 Users:');
  console.log(
    '   - College A: Standard University (slug: standard-univ, id:',
    collegeA._id.toString() + ')'
  );
  console.log(
    '     Admin: admin@standard.edu | Student: student@standard.edu (Password: StudentPass@2026!)'
  );
  console.log(
    '   - College B: Ganesh Vidyalay (slug: ganesh-vidyalay, id:',
    collegeB._id.toString() + ')'
  );
  console.log(
    '     Admin: admin@ganesh.edu | Student: student@ganesh.edu (Password: StudentPass@2026!)'
  );
  console.log('   - Books and active Loans seeded for both institutions.');
  console.log('   - Loan indexes synced successfully in MongoDB.');

  process.exit(0);
}

seedProofData().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
