const asyncHandler = require('express-async-handler');
const Book = require('../../models/Book');
const Loan = require('../../models/Loan');
const User = require('../../models/User');
const Fine = require('../../models/Fine');
const Reservation = require('../../models/Reservation');
const EResource = require('../../models/EResource');

// @desc    Get Student Dashboard summary data
// @route   GET /api/dashboards/student
// @access  Private/Student
const getStudentDashboardSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const activeLoans = await Loan.countDocuments({ userId, status: 'active' });
  const pendingFines = await Fine.aggregate([
    { $match: { userId, status: 'unpaid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const reservedBooks = await Reservation.countDocuments({ userId, status: { $in: ['pending', 'ready_for_pickup'] } });

  res.json({
    success: true,
    data: {
      activeLoans,
      pendingFines: pendingFines[0]?.total || 0,
      reservedBooks,
      notifications: 0
    }
  });
});

// @desc    Search OPAC Catalog
// @route   GET /api/dashboards/student/catalog
// @access  Private/Student
const searchCatalog = asyncHandler(async (req, res) => {
  const { query, category, format, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  let filter = {};
  
  if (query) {
    filter.$text = { $search: query };
  }
  if (category) {
    filter.category = category;
  }
  if (format) {
    filter.format = format;
  }

  const books = await Book.find(filter)
    .skip(skip)
    .limit(Number(limit))
    .select('-__v');

  const total = await Book.countDocuments(filter);

  res.json({
    success: true,
    data: books,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get Smart Recommendations
// @route   GET /api/dashboards/student/catalog/recommendations
// @access  Private/Student
const getRecommendations = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  // Recommend based on major or fallback to generally popular
  let filter = {};
  if (user.major) {
    filter = { category: new RegExp(user.major, 'i') };
  }

  const recommendations = await Book.find(filter).limit(5);

  res.json({
    success: true,
    data: recommendations
  });
});

// @desc    Get E-Resources
// @route   GET /api/dashboards/student/eresources
// @access  Private/Student
const getEResources = asyncHandler(async (req, res) => {
  const resources = await EResource.find({ status: 'approved' });
  res.json({
    success: true,
    data: resources
  });
});

// @desc    Get Current Borrowing & History
// @route   GET /api/dashboards/student/loans
// @access  Private/Student
const getMyLoans = asyncHandler(async (req, res) => {
  const loans = await Loan.find({ userId: req.user._id })
    .populate('bookId', 'title author coverImage')
    .sort({ issueDate: -1 });

  const active = loans.filter(l => l.status === 'active' || l.status === 'overdue');
  const history = loans.filter(l => l.status === 'returned');

  res.json({
    success: true,
    data: { active, history }
  });
});

// @desc    Renew a Book
// @route   POST /api/dashboards/student/loans/:id/renew
// @access  Private/Student
const renewLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, userId: req.user._id });
  
  if (!loan) {
    res.status(404);
    throw new Error('Loan not found');
  }

  if (loan.renewCount >= loan.maxRenewals) {
    res.status(400);
    throw new Error('Maximum renewal limit reached');
  }

  // Check if anyone has reserved this book
  const reservations = await Reservation.countDocuments({ bookId: loan.bookId, status: 'pending' });
  if (reservations > 0) {
    res.status(400);
    throw new Error('Cannot renew: This book has been requested by another patron');
  }

  loan.renewCount += 1;
  const newDueDate = new Date(loan.dueDate);
  newDueDate.setDate(newDueDate.getDate() + 14); // Extend by 14 days
  loan.dueDate = newDueDate;

  await loan.save();

  res.json({
    success: true,
    data: loan,
    message: 'Book renewed successfully'
  });
});

// @desc    Place a Hold / Reservation
// @route   POST /api/dashboards/student/reservations
// @access  Private/Student
const placeHold = asyncHandler(async (req, res) => {
  const { bookId } = req.body;

  const book = await Book.findById(bookId);
  if (!book) {
    res.status(404);
    throw new Error('Book not found');
  }

  if (book.availableCopies > 0) {
    res.status(400);
    throw new Error('Book is currently available. You can check it out directly.');
  }

  const existingHold = await Reservation.findOne({ userId: req.user._id, bookId, status: 'pending' });
  if (existingHold) {
    res.status(400);
    throw new Error('You already have a hold placed on this book.');
  }

  // Find current queue length
  const queueLength = await Reservation.countDocuments({ bookId, status: 'pending' });

  const reservation = await Reservation.create({
    userId: req.user._id,
    bookId,
    queuePosition: queueLength + 1,
    status: 'pending'
  });

  res.status(201).json({
    success: true,
    data: reservation,
    message: `Hold placed successfully. You are number ${reservation.queuePosition} in the queue.`
  });
});

// @desc    Get My Hold Queue
// @route   GET /api/dashboards/student/reservations/queue
// @access  Private/Student
const getMyQueue = asyncHandler(async (req, res) => {
  const queue = await Reservation.find({ userId: req.user._id })
    .populate('bookId', 'title author coverImage')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: queue
  });
});

// @desc    Get Itemized Fines
// @route   GET /api/dashboards/student/fines
// @access  Private/Student
const getMyFines = asyncHandler(async (req, res) => {
  const fines = await Fine.find({ userId: req.user._id })
    .populate('loanId')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: fines
  });
});

module.exports = {
  getStudentDashboardSummary,
  searchCatalog,
  getRecommendations,
  getEResources,
  getMyLoans,
  renewLoan,
  placeHold,
  getMyQueue,
  getMyFines
};
