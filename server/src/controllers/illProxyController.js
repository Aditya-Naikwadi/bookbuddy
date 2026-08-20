const asyncHandler = require('../utils/asyncHandler');
const Book = require('../models/Book');
const ILLRequest = require('../models/ILLRequest');
const AuditLog = require('../models/AuditLog');
const AppError = require('../utils/AppError');

// @desc    Search partner college shared catalog items (Strictly audited permeable boundary)
// @route   GET /api/v1/ill/catalog
// @access  Private
const searchILLCatalog = asyncHandler(async (req, res) => {
  const { query, category } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Security Policy: Strictly require isILLShared: true AND exclude own collegeId
  const filter = {
    isILLShared: true,
    collegeId: { $ne: req.user.collegeId },
    copiesAvailable: { $gt: 0 },
  };

  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: 'i' } },
      { author: { $regex: query, $options: 'i' } },
    ];
  }

  if (category) {
    filter.category = category;
  }

  const total = await Book.countDocuments(filter);
  const books = await Book.find(filter)
    .populate('collegeId', 'name shortName code')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.json({
    success: true,
    data: books,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc    Create ILL Request for a shared book
// @route   POST /api/v1/ill/request
// @access  Private
const createILLRequest = asyncHandler(async (req, res) => {
  const { bookId } = req.body;

  const book = await Book.findById(bookId);

  if (!book) {
    throw new AppError('Book not found in inter-library catalog', 404);
  }

  // Security Check: Enforce isILLShared flag
  if (!book.isILLShared) {
    throw new AppError(
      'Access Denied: This catalog item is not shared for inter-library loan',
      403
    );
  }

  if (book.collegeId.toString() === req.user.collegeId.toString()) {
    throw new AppError('Cannot request ILL for a book owned by your own college', 400);
  }

  if (book.copiesAvailable < 1) {
    throw new AppError('No available copies remaining for ILL request', 400);
  }

  const illRequest = await ILLRequest.create({
    borrowingCollegeId: req.user.collegeId,
    lendingCollegeId: book.collegeId,
    requestingUserId: req.user.id,
    bookId: book._id,
    status: 'requested',
    statusHistory: [
      {
        status: 'requested',
        updatedBy: req.user.id,
        note: 'Inter-Library Loan request submitted by patron',
      },
    ],
  });

  // Audit Logging for Security Compliance
  await AuditLog.create({
    collegeId: req.user.collegeId,
    userId: req.user.id,
    action: 'ILL_REQUEST_CREATED',
    resource: 'ILLRequest',
    resourceId: illRequest._id.toString(),
    details: {
      lendingCollegeId: book.collegeId,
      bookId: book._id,
      title: book.title,
    },
  });

  res.status(201).json({
    success: true,
    data: illRequest,
  });
});

// @desc    Get ILL Requests for college (as borrowing or lending institution)
// @route   GET /api/v1/ill/requests
// @access  Private
const getILLRequests = asyncHandler(async (req, res) => {
  const { role = 'borrowing' } = req.query;

  const filter =
    role === 'lending'
      ? { lendingCollegeId: req.user.collegeId }
      : { borrowingCollegeId: req.user.collegeId };

  if (req.user.role === 'student') {
    filter.requestingUserId = req.user.id;
  }

  const requests = await ILLRequest.find(filter)
    .populate('borrowingCollegeId', 'name shortName')
    .populate('lendingCollegeId', 'name shortName')
    .populate('requestingUserId', 'name email')
    .populate('bookId', 'title author isbn')
    .sort('-createdAt');

  res.json({
    success: true,
    data: requests,
  });
});

// @desc    Update ILL Request Status (Staff / Admin of lending or borrowing college)
// @route   PATCH /api/v1/ill/requests/:id/status
// @access  Private (Staff/Admin)
const updateILLStatus = asyncHandler(async (req, res) => {
  const { status, note, shippingTrackingId, dueDate } = req.body;

  const illRequest = await ILLRequest.findById(req.params.id);

  if (!illRequest) {
    throw new AppError('ILL Request not found', 404);
  }

  // Tenant Boundary Check: User must belong to either lending or borrowing college
  const userCollegeStr = req.user.collegeId.toString();
  const isLender = illRequest.lendingCollegeId.toString() === userCollegeStr;
  const isBorrower = illRequest.borrowingCollegeId.toString() === userCollegeStr;

  if (!isLender && !isBorrower && req.user.role !== 'super-admin') {
    throw new AppError('Forbidden: Not authorized to manage this cross-college request', 403);
  }

  illRequest.status = status;
  if (shippingTrackingId) illRequest.shippingTrackingId = shippingTrackingId;
  if (dueDate) illRequest.dueDate = dueDate;

  illRequest.statusHistory.push({
    status,
    updatedBy: req.user.id,
    note: note || `Status updated to ${status}`,
  });

  await illRequest.save();

  // Audit Log State Transition
  await AuditLog.create({
    collegeId: req.user.collegeId,
    userId: req.user.id,
    action: 'ILL_REQUEST_STATUS_UPDATED',
    resource: 'ILLRequest',
    resourceId: illRequest._id.toString(),
    details: {
      newStatus: status,
      lendingCollegeId: illRequest.lendingCollegeId,
      borrowingCollegeId: illRequest.borrowingCollegeId,
    },
  });

  res.json({
    success: true,
    data: illRequest,
  });
});

module.exports = {
  searchILLCatalog,
  createILLRequest,
  getILLRequests,
  updateILLStatus,
};
