const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Import all models
const User = require('./models/User');
const Book = require('./models/Book');
const Loan = require('./models/Loan');
const Fine = require('./models/Fine');
const Reservation = require('./models/Reservation');
const EResource = require('./models/EResource');
const LabSeat = require('./models/LabSeat');
const LabBooking = require('./models/LabBooking');
const ReadingList = require('./models/ReadingList');
const Bookmark = require('./models/Bookmark');
const BookSuggestion = require('./models/BookSuggestion');
const Feedback = require('./models/Feedback');
const Complaint = require('./models/Complaint');
const Notification = require('./models/Notification');
const NotificationPreference = require('./models/NotificationPreference');
const Sticker = require('./models/Sticker');
const StreakReward = require('./models/StreakReward');
const Streak = require('./models/Streak');
const UserSticker = require('./models/UserSticker');

const connectDB = require('./config/db');

dotenv.config({ path: require('path').join(__dirname, '../.env') });

const importData = async () => {
  try {
    await connectDB();
    console.log('Clearing database...');
    await User.deleteMany();
    await Book.deleteMany();
    await Loan.deleteMany();
    await Fine.deleteMany();
    await Reservation.deleteMany();
    await EResource.deleteMany();
    await LabSeat.deleteMany();
    await LabBooking.deleteMany();
    await ReadingList.deleteMany();
    await Bookmark.deleteMany();
    await BookSuggestion.deleteMany();
    await Feedback.deleteMany();
    await Complaint.deleteMany();
    await Notification.deleteMany();
    await NotificationPreference.deleteMany();
    await Sticker.deleteMany();
    await StreakReward.deleteMany();
    await Streak.deleteMany();
    await UserSticker.deleteMany();

    console.log('Seeding demo users...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Demo@123', salt);

    const users = await User.create([
      {
        studentId: 'STU1001',
        name: 'Demo Student',
        email: 'student@bookbuddy.com',
        password: hashedPassword, // 'Demo@123'
        role: 'student',
        collegeId: 'COLLEGE_A',
        major: 'Computer Science',
      },
      {
        studentId: 'LIB2001',
        name: 'Super Admin',
        email: 'admin@bookbuddy.com',
        password: hashedPassword,
        collegeId: 'GLOBAL',
        role: 'super-admin',
      },
      {
        studentId: 'COL3001',
        name: 'College Admin',
        email: 'collegeadmin@bookbuddy.com',
        password: hashedPassword,
        collegeId: 'COLLEGE_A',
        role: 'college-admin',
      },
      {
        studentId: 'GEN4001',
        name: 'General User',
        email: 'general@bookbuddy.com',
        password: hashedPassword,
        collegeId: 'COLLEGE_A',
        role: 'general',
      },
    ]);

    const studentId = users[0]._id;

    console.log('Seeding demo books...');
    const books = await Book.create([
      {
        collegeId: 'COLLEGE_A',
        title: 'The Pragmatic Programmer',
        author: 'Andrew Hunt, David Thomas',
        isbn: '978-0201616224',
        category: ['Computer Science', 'Programming'],
        subjects: ['Software Engineering'],
        tags: ['best practices'],
        publishedYear: 1999,
        totalCopies: 5,
        availableCopies: 4,
        availabilityStatus: 'available',
        location: 'Rack A1, Shelf 2',
        description: 'A book about software engineering.',
        coverImage:
          'https://images-na.ssl-images-amazon.com/images/I/41as+WafrFL._SX396_BO1,204,203,200_.jpg',
      },
      {
        collegeId: 'COLLEGE_A',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '978-0132350884',
        category: ['Computer Science'],
        subjects: ['Programming'],
        tags: ['cleancode'],
        publishedYear: 2008,
        totalCopies: 3,
        availableCopies: 0,
        availabilityStatus: 'checked_out',
        location: 'Rack A1, Shelf 3',
        description: 'A Handbook of Agile Software Craftsmanship.',
        coverImage:
          'https://images-na.ssl-images-amazon.com/images/I/41jEbK-jG+L._SX373_BO1,204,203,200_.jpg',
      },
      {
        collegeId: 'COLLEGE_A',
        title: 'Design Patterns',
        author: 'Erich Gamma',
        isbn: '978-0201633610',
        category: ['Computer Science', 'Design'],
        subjects: ['Software Architecture'],
        tags: ['oop'],
        publishedYear: 1994,
        totalCopies: 2,
        availableCopies: 2,
        availabilityStatus: 'available',
        location: 'Rack A2, Shelf 1',
        description: 'Elements of Reusable Object-Oriented Software.',
        coverImage:
          'https://images-na.ssl-images-amazon.com/images/I/51szD9HC9pL._SX395_BO1,204,203,200_.jpg',
      },
      {
        collegeId: 'COLLEGE_A',
        title: 'Introduction to Algorithms',
        author: 'Thomas H. Cormen',
        isbn: '978-0262033848',
        category: ['Computer Science', 'Algorithms'],
        subjects: ['Mathematics'],
        tags: ['DSA'],
        publishedYear: 2009,
        totalCopies: 10,
        availableCopies: 9,
        availabilityStatus: 'available',
        location: 'Rack B1, Shelf 1',
        description: 'Comprehensive guide to algorithms.',
      },
      {
        collegeId: 'COLLEGE_A',
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '978-0134757599',
        category: ['Computer Science'],
        subjects: ['Software Engineering'],
        tags: ['refactoring'],
        publishedYear: 2018,
        totalCopies: 4,
        availableCopies: 4,
        availabilityStatus: 'available',
        location: 'Rack A1, Shelf 4',
        description: 'Improving the Design of Existing Code.',
      },
    ]);

    console.log('Seeding active loans, fines, and queue...');

    // Active Loan
    const activeLoanDate = new Date();
    activeLoanDate.setDate(activeLoanDate.getDate() - 5);
    const activeDueDate = new Date();
    activeDueDate.setDate(activeDueDate.getDate() + 9); // Due in 9 days

    await Loan.create({
      collegeId: 'COLLEGE_A',
      userId: studentId,
      bookId: books[0]._id, // Pragmatic Programmer
      issueDate: activeLoanDate,
      dueDate: activeDueDate,
      status: 'active',
    });

    // History Loan
    const pastLoanDate = new Date();
    pastLoanDate.setDate(pastLoanDate.getDate() - 30);
    const pastReturnDate = new Date();
    pastReturnDate.setDate(pastReturnDate.getDate() - 15);

    const returnedLoan = await Loan.create({
      collegeId: 'COLLEGE_A',
      userId: studentId,
      bookId: books[4]._id, // Refactoring
      issueDate: pastLoanDate,
      dueDate: pastReturnDate,
      returnDate: pastReturnDate,
      status: 'returned',
    });

    // Hold Queue
    await Reservation.create({
      collegeId: 'COLLEGE_A',
      userId: studentId,
      bookId: books[1]._id, // Clean Code (checked out)
      queuePosition: 2,
      status: 'pending',
    });

    // Fine
    await Fine.create({
      collegeId: 'COLLEGE_A',
      userId: studentId,
      loanId: returnedLoan._id,
      daysOverdue: 9,
      amount: 45,
      reason: 'Overdue: Cracking the Coding Interview',
      status: 'unpaid',
    });

    console.log('Seeding Lab Seats...');
    const seats = [];
    for (let i = 1; i <= 10; i++) {
      seats.push({
        collegeId: 'COLLEGE_A',
        seatNumber: `PC-${i.toString().padStart(2, '0')}`,
        status: i % 5 === 0 ? 'maintenance' : 'available',
        computerSpecs: 'i7 12700K, 32GB RAM, RTX 3060',
      });
    }
    await LabSeat.create(seats);

    console.log('Seeding E-Resources...');
    await EResource.create([
      {
        title: 'Machine Learning Basics',
        type: 'PDF',
        url: 'https://example.com/ml-basics.pdf',
        category: 'Open Access',
        status: 'approved',
        externalId: -1,
      },
      {
        title: 'Journal of Computer Science Vol 45',
        type: 'EPUB',
        url: 'https://example.com/jcs-v45.epub',
        category: 'Research Journals',
        status: 'approved',
        externalId: -2,
      },
    ]);

    console.log('Seeding Stickers & Streak Rewards...');
    await Sticker.create([
      {
        code: 'STRK_3',
        name: '3-Day Reader',
        description: 'Read for 3 consecutive days.',
        icon: '🔥',
        category: 'streak_milestone',
        criteriaType: 'streak_days',
        criteriaValue: 3,
        rarity: 'common',
      },
      {
        code: 'STRK_7',
        name: 'Week Warrior',
        description: 'Read for 7 consecutive days.',
        icon: '📅',
        category: 'streak_milestone',
        criteriaType: 'streak_days',
        criteriaValue: 7,
        rarity: 'common',
      },
      {
        code: 'STRK_14',
        name: 'Fortnight Finisher',
        description: 'Read for 14 consecutive days.',
        icon: '⏳',
        category: 'streak_milestone',
        criteriaType: 'streak_days',
        criteriaValue: 14,
        rarity: 'rare',
      },
      {
        code: 'STRK_30',
        name: 'Month Master',
        description: 'Read for 30 consecutive days.',
        icon: '🏆',
        category: 'streak_milestone',
        criteriaType: 'streak_days',
        criteriaValue: 30,
        rarity: 'epic',
      },
      {
        code: 'EXPL_GENRE_5',
        name: 'Genre Explorer',
        description: 'Borrow books from 5 different genres.',
        icon: '🗺️',
        category: 'exploration',
        criteriaType: 'genre_count',
        criteriaValue: 5,
        rarity: 'rare',
      },
      {
        code: 'EXPL_LAB_5',
        name: 'Lab Regular',
        description: 'Complete 5 lab bookings.',
        icon: '💻',
        category: 'exploration',
        criteriaType: 'lab_count',
        criteriaValue: 5,
        rarity: 'common',
      },
    ]);

    await StreakReward.create([
      { streakDays: 3, rewardType: 'visual_upgrade', rewardPayload: { theme: 'silver_flame' } },
      { streakDays: 7, rewardType: 'freeze', rewardPayload: {} },
      { streakDays: 14, rewardType: 'patron_theme', rewardPayload: { theme: 'gold_card' } },
      {
        streakDays: 30,
        rewardType: 'certificate',
        rewardPayload: { fileUrl: '/certificates/30-day.pdf' },
      },
      { streakDays: 60, rewardType: 'early_access', rewardPayload: {} },
    ]);

    console.log('Database successfully seeded! 🌱');
    process.exit();
  } catch (error) {
    console.error(`Error with data import: ${error}`);
    process.exit(1);
  }
};

importData();
