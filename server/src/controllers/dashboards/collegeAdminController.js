const asyncHandler = require('express-async-handler');
const User = require('../../models/User');
const Book = require('../../models/Book');
const Loan = require('../../models/Loan');
const Reservation = require('../../models/Reservation');
const EResource = require('../../models/EResource');
const Fine = require('../../models/Fine');
const Complaint = require('../../models/Complaint');
const bcrypt = require('bcryptjs');
const { recordQualifyingAction } = require('../../services/streakService');

// =====================================
// PATRON MANAGEMENT
// =====================================

// @desc    Create new student
// @route   POST /api/dashboards/college-admin/patrons
// @access  Private/CollegeAdmin
const createStudent = asyncHandler(async (req, res) => {
  const { name, email, password, studentId } = req.body;
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const student = await User.create({
    name,
    email,
    password: hashedPassword,
    role: 'student',
    studentId
  });

  res.status(201).json({ success: true, data: student });
});

// @desc    Get all patrons
// @route   GET /api/dashboards/college-admin/patrons
// @access  Private/CollegeAdmin
const getAllPatrons = asyncHandler(async (req, res) => {
  const patrons = await User.find({ role: 'student' }).select('-password');
  res.json({ success: true, data: patrons });
});

// @desc    Get patron details (loans, fines)
// @route   GET /api/dashboards/college-admin/patrons/:id
// @access  Private/CollegeAdmin
const getPatronDetails = asyncHandler(async (req, res) => {
  const patron = await User.findById(req.params.id).select('-password');
  const loans = await Loan.find({ userId: req.params.id }).populate('bookId', 'title author coverImage');
  const fines = await Fine.find({ userId: req.params.id });
  
  if (!patron) {
    res.status(404);
    throw new Error('Patron not found');
  }

  res.json({ success: true, data: { patron, loans, fines } });
});

// =====================================
// CIRCULATION & QUEUE
// =====================================

// @desc    Staff override checkout
// @route   POST /api/dashboards/college-admin/circulation/checkout
// @access  Private/CollegeAdmin
const checkoutBook = asyncHandler(async (req, res) => {
  const { userId, bookId } = req.body;
  
  const book = await Book.findById(bookId);
  if (!book || book.availableCopies <= 0) {
    res.status(400);
    throw new Error('Book not available');
  }

  book.availableCopies -= 1;
  await book.save();

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const loan = await Loan.create({
    userId,
    bookId,
    issueDate: Date.now(),
    dueDate,
    status: 'active'
  });

  const streakData = await recordQualifyingAction(userId, 'checkout_book');
  if (streakData && req.app.get('io')) {
    req.app.get('io').to(`user:${userId}`).emit('streak:updated', streakData);
  }

  res.status(201).json({ success: true, data: loan });
});

// @desc    Staff override return
// @route   POST /api/dashboards/college-admin/circulation/return
// @access  Private/CollegeAdmin
const returnBook = asyncHandler(async (req, res) => {
  const { loanId } = req.body;
  const loan = await Loan.findById(loanId);

  if (!loan || loan.status === 'returned') {
    res.status(400);
    throw new Error('Invalid or already returned loan');
  }

  loan.status = 'returned';
  loan.returnDate = Date.now();
  await loan.save();

  const book = await Book.findById(loan.bookId);
  book.availableCopies += 1;
  await book.save();

  const streakData = await recordQualifyingAction(loan.userId, 'return_book');
  if (streakData && req.app.get('io')) {
    req.app.get('io').to(`user:${loan.userId}`).emit('streak:updated', streakData);
  }

  res.json({ success: true, data: loan });
});

// @desc    Get current hold queue
// @route   GET /api/dashboards/college-admin/circulation/queue
// @access  Private/CollegeAdmin
const getHoldQueue = asyncHandler(async (req, res) => {
  const queue = await Reservation.find()
    .populate('bookId', 'title author')
    .populate('userId', 'name email studentId')
    .sort('createdAt');
  res.json({ success: true, data: queue });
});

// =====================================
// CATALOGING & DAM
// =====================================

// @desc    Add physical book
// @route   POST /api/dashboards/college-admin/catalog
// @access  Private/CollegeAdmin
const addBook = asyncHandler(async (req, res) => {
  const book = await Book.create(req.body);
  res.status(201).json({ success: true, data: book });
});

// @desc    Update physical book
// @route   PUT /api/dashboards/college-admin/catalog/:id
// @access  Private/CollegeAdmin
const updateBook = asyncHandler(async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: book });
});

// @desc    Upload college e-resource
// @route   POST /api/dashboards/college-admin/resources
// @access  Private/CollegeAdmin
const uploadCollegeResource = asyncHandler(async (req, res) => {
  const resource = await EResource.create({ ...req.body, uploadedBy: req.user._id });
  res.status(201).json({ success: true, data: resource });
});

// =====================================
// FINES & TICKETING
// =====================================

// @desc    Get all pending fines
// @route   GET /api/dashboards/college-admin/fines
// @access  Private/CollegeAdmin
const getPendingFines = asyncHandler(async (req, res) => {
  const fines = await Fine.find({ status: 'unpaid' }).populate('userId', 'name studentId');
  res.json({ success: true, data: fines });
});

// @desc    Process fine payment
// @route   POST /api/dashboards/college-admin/fines/:id/pay
// @access  Private/CollegeAdmin
const processPayment = asyncHandler(async (req, res) => {
  const fine = await Fine.findById(req.params.id);
  if (!fine) {
    res.status(404);
    throw new Error('Fine not found');
  }
  fine.status = 'paid';
  fine.paidDate = Date.now();
  await fine.save();
  res.json({ success: true, data: fine });
});

// @desc    Get helpdesk tickets
// @route   GET /api/dashboards/college-admin/helpdesk
// @access  Private/CollegeAdmin
const getHelpdeskTickets = asyncHandler(async (req, res) => {
  const tickets = await Complaint.find().populate('userId', 'name studentId').sort('-createdAt');
  res.json({ success: true, data: tickets });
});

// @desc    Resolve ticket
// @route   PUT /api/dashboards/college-admin/helpdesk/:id/resolve
// @access  Private/CollegeAdmin
const resolveTicket = asyncHandler(async (req, res) => {
  const ticket = await Complaint.findById(req.params.id);
  if (!ticket) {
    res.status(404);
    throw new Error('Ticket not found');
  }
  ticket.status = 'resolved';
  if (req.body.resolution) {
    ticket.resolution = req.body.resolution;
  }
  await ticket.save();
  res.json({ success: true, data: ticket });
});

// =====================================
// ANALYTICS
// =====================================

// @desc    Get Analytics Summary
// @route   GET /api/dashboards/college-admin/analytics/summary
// @access  Private/CollegeAdmin
const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const totalStudents = await User.countDocuments({ role: 'student' });
  const activeLoans = await Loan.countDocuments({ status: 'active' });
  const pendingFinesAgg = await Fine.aggregate([
    { $match: { status: 'unpaid' } },
    { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
  ]);
  const unpaidFinesTotal = pendingFinesAgg[0] ? pendingFinesAgg[0].totalAmount : 0;
  
  res.json({
    success: true,
    data: {
      totalStudents,
      activeLoans,
      unpaidFinesTotal,
      timestamp: Date.now()
    }
  });
});

module.exports = {
  createStudent,
  getAllPatrons,
  getPatronDetails,
  checkoutBook,
  returnBook,
  getHoldQueue,
  addBook,
  updateBook,
  uploadCollegeResource,
  getPendingFines,
  processPayment,
  getHelpdeskTickets,
  resolveTicket,
  getAnalyticsSummary
};
