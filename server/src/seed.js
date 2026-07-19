const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

// Import all models
const College = require('./models/College');
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
    await College.deleteMany();
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

    // Drop stale indexes to prevent validation duplicate key violations
    try {
      await Sticker.collection.dropIndex('code_1');
      console.log('Dropped stale code_1 index from stickers collection.');
    } catch {
      // Index might not exist, ignore
    }

    try {
      await StreakReward.collection.dropIndex('streakDays_1');
      console.log('Dropped stale streakDays_1 index from streakrewards collection.');
    } catch {
      // Index might not exist, ignore
    }

    console.log('Seeding College tenant...');
    const college = await College.create({
      name: 'Demo College',
      code: 'COLLEGE_A',
    });
    const collegeId = college._id;

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
        collegeId: collegeId,
        major: 'Computer Science',
      },
      {
        studentId: 'LIB2001',
        name: 'Super Admin',
        email: 'admin@bookbuddy.com',
        password: hashedPassword,
        role: 'super-admin',
      },
      {
        studentId: 'COL3001',
        name: 'College Admin',
        email: 'collegeadmin@bookbuddy.com',
        password: hashedPassword,
        collegeId: collegeId,
        role: 'college-admin',
      },
      {
        studentId: 'GEN4001',
        name: 'General User',
        email: 'general@bookbuddy.com',
        password: hashedPassword,
        collegeId: collegeId,
        role: 'general',
      },
    ]);

    const studentId = users[0]._id;
    const adminId = users[1]._id;

    console.log('Seeding demo books...');
    const books = await Book.create([
      {
        collegeId: collegeId,
        title: 'The Pragmatic Programmer',
        author: 'Andrew Hunt, David Thomas',
        isbn: '978-0201616224',
        category: 'Computer Science',
        copiesTotal: 5,
        copiesAvailable: 4,
        shelfLocation: 'Rack A1, Shelf 2',
      },
      {
        collegeId: collegeId,
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '978-0132350884',
        category: 'Computer Science',
        copiesTotal: 3,
        copiesAvailable: 0,
        shelfLocation: 'Rack A1, Shelf 3',
      },
      {
        collegeId: collegeId,
        title: 'Design Patterns',
        author: 'Erich Gamma',
        isbn: '978-0201633610',
        category: 'Computer Science',
        copiesTotal: 2,
        copiesAvailable: 2,
        shelfLocation: 'Rack A2, Shelf 1',
      },
      {
        collegeId: collegeId,
        title: 'Introduction to Algorithms',
        author: 'Thomas H. Cormen',
        isbn: '978-0262033848',
        category: 'Computer Science',
        copiesTotal: 10,
        copiesAvailable: 9,
        shelfLocation: 'Rack B1, Shelf 1',
      },
      {
        collegeId: collegeId,
        title: 'Refactoring',
        author: 'Martin Fowler',
        isbn: '978-0134757599',
        category: 'Computer Science',
        copiesTotal: 4,
        copiesAvailable: 4,
        shelfLocation: 'Rack A1, Shelf 4',
      },
    ]);

    console.log('Seeding active loans, fines, and queue...');

    // Active Loan
    const activeLoanDate = new Date();
    activeLoanDate.setDate(activeLoanDate.getDate() - 5);
    const activeDueDate = new Date();
    activeDueDate.setDate(activeDueDate.getDate() + 9); // Due in 9 days

    await Loan.create({
      collegeId: collegeId,
      userId: studentId,
      bookId: books[0]._id, // Pragmatic Programmer
      issueDate: activeLoanDate,
      dueDate: activeDueDate,
      status: 'active',
      maxRenewals: 3,
      issuedBy: adminId, // Required by Loan schema
    });

    // History Loan
    const pastLoanDate = new Date();
    pastLoanDate.setDate(pastLoanDate.getDate() - 30);
    const pastReturnDate = new Date();
    pastReturnDate.setDate(pastReturnDate.getDate() - 15);

    const returnedLoan = await Loan.create({
      collegeId: collegeId,
      userId: studentId,
      bookId: books[4]._id, // Refactoring
      issueDate: pastLoanDate,
      dueDate: pastReturnDate,
      returnDate: pastReturnDate,
      status: 'returned',
      maxRenewals: 3,
      issuedBy: adminId,
    });

    // Hold Queue
    await Reservation.create({
      collegeId: collegeId,
      userId: studentId,
      bookId: books[1]._id, // Clean Code (checked out)
      queuePosition: 2,
      status: 'queued',
    });

    // Fine
    await Fine.create({
      collegeId: collegeId,
      userId: studentId,
      loanId: returnedLoan._id,
      daysOverdue: 9,
      overdueDays: 9,
      amount: 45,
      reason: 'Overdue: Refactoring',
      status: 'unpaid',
    });

    console.log('Seeding Lab Seats...');
    const seats = [];
    for (let i = 1; i <= 10; i++) {
      seats.push({
        collegeId: collegeId,
        labName: 'Central Computing Lab',
        seatNumber: `PC-${i.toString().padStart(2, '0')}`,
        maintenanceStatus: i % 5 === 0 ? 'maintenance' : 'operational',
        specs: 'i7 12700K, 32GB RAM, RTX 3060',
      });
    }
    await LabSeat.create(seats);

    console.log('Seeding E-Resources...');
    await EResource.create([
      {
        collegeId: collegeId,
        title: 'Machine Learning Basics',
        author: 'Andrew Ng',
        type: 'pdf',
        fileUrl: 'https://example.com/ml-basics.pdf',
        category: 'Open Access',
        uploadedBy: adminId,
        moderationStatus: 'approved',
        externalId: -1,
      },
      {
        collegeId: collegeId,
        title: 'Journal of Computer Science Vol 45',
        author: 'IEEE',
        type: 'epub',
        fileUrl: 'https://example.com/jcs-v45.epub',
        category: 'Research Journals',
        uploadedBy: adminId,
        moderationStatus: 'approved',
        externalId: -2,
      },
    ]);

    console.log('Seeding Stickers & Streak Rewards...');
    await Sticker.create([
      {
        name: '3-Day Reader',
        rarity: 'common',
        iconUrl: '🔥',
        criteria: 'Read for 3 consecutive days.',
      },
      {
        name: 'Week Warrior',
        rarity: 'common',
        iconUrl: '📅',
        criteria: 'Read for 7 consecutive days.',
      },
      {
        name: 'Fortnight Finisher',
        rarity: 'rare',
        iconUrl: '⏳',
        criteria: 'Read for 14 consecutive days.',
      },
      {
        name: 'Month Master',
        rarity: 'epic',
        iconUrl: '🏆',
        criteria: 'Read for 30 consecutive days.',
      },
      {
        name: 'Genre Explorer',
        rarity: 'rare',
        iconUrl: '🗺️',
        criteria: 'Borrow books from 5 different genres.',
      },
      {
        name: 'Lab Regular',
        rarity: 'common',
        iconUrl: '💻',
        criteria: 'Complete 5 lab bookings.',
      },
    ]);

    await StreakReward.create([
      { milestoneThreshold: 3, rewardType: 'theme', rewardValue: 'silver_flame' },
      { milestoneThreshold: 7, rewardType: 'freeze', rewardValue: '1' },
      { milestoneThreshold: 14, rewardType: 'theme', rewardValue: 'gold_card' },
      { milestoneThreshold: 30, rewardType: 'badge', rewardValue: 'month_master' },
      { milestoneThreshold: 60, rewardType: 'freeze', rewardValue: '2' },
    ]);

    console.log('Database successfully seeded! 🌱');
    process.exit();
  } catch (error) {
    console.error(`Error with data import: ${error}`);
    process.exit(1);
  }
};

importData();
