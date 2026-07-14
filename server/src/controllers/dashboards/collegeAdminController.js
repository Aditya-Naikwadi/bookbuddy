// Controller managing college-admin operational endpoints (circulation, patrons, and fines).
const User = require('../../models/User');
const Book = require('../../models/Book');
const Loan = require('../../models/Loan');
const Reservation = require('../../models/Reservation');
const Fine = require('../../models/Fine');
const Complaint = require('../../models/Complaint');
const EResource = require('../../models/EResource');
const LabSeat = require('../../models/LabSeat');
const LabBooking = require('../../models/LabBooking');
const BookSuggestion = require('../../models/BookSuggestion');
const Feedback = require('../../models/Feedback');
const loanService = require('../../services/loanService');
const notificationService = require('../../services/notificationService');
const AppError = require('../../utils/AppError');

// @desc    Create new student
// @route   POST /api/dashboards/college-admin/patrons
// @access  Private/CollegeAdmin
const createStudent = async (req, res, next) => {
  try {
    const { name, email, password, studentId } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(new AppError('User already exists.', 400));
    }

    const student = await User.create({
      name,
      email,
      password,
      role: 'student',
      studentId,
      collegeId: req.user.collegeId,
    });

    res.status(201).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all patrons
// @route   GET /api/dashboards/college-admin/patrons
// @access  Private/CollegeAdmin
const getAllPatrons = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const patrons = await User.find({ role: 'student', ...req.tenantFilter })
      .select('-password')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.json({ success: true, data: patrons });
  } catch (error) {
    next(error);
  }
};

// @desc    Get patron details (loans, fines)
// @route   GET /api/dashboards/college-admin/patrons/:id
// @access  Private/CollegeAdmin
const getPatronDetails = async (req, res, next) => {
  try {
    const patron = await User.findOne({
      _id: req.params.id,
      role: 'student',
      ...req.tenantFilter,
    }).select('-password');

    if (!patron) {
      return next(new AppError('Patron not found', 404));
    }

    const loans = await Loan.find({ userId: req.params.id, ...req.tenantFilter }).populate(
      'bookId'
    );
    const fines = await Fine.find({ userId: req.params.id, ...req.tenantFilter });

    res.json({ success: true, data: { patron, loans, fines } });
  } catch (error) {
    next(error);
  }
};

// @desc    Add physical book
// @route   POST /api/dashboards/college-admin/catalog
// @access  Private/CollegeAdmin
const addBook = async (req, res, next) => {
  try {
    const book = await Book.create({ ...req.body, collegeId: req.user.collegeId });
    res.status(201).json({ success: true, data: book });
  } catch (error) {
    next(error);
  }
};

// @desc    Update physical book
// @route   PUT /api/dashboards/college-admin/catalog/:id
// @access  Private/CollegeAdmin
const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      {
        new: true,
      }
    );
    if (!book) {
      return next(new AppError('Book not found or unauthorized', 404));
    }
    res.json({ success: true, data: book });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload college e-resource
// @route   POST /api/dashboards/college-admin/resources
// @access  Private/CollegeAdmin
const uploadCollegeResource = async (req, res, next) => {
  try {
    const resource = await EResource.create({ ...req.body, uploadedBy: req.user.id });
    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    next(error);
  }
};

// @desc    Get helpdesk tickets
// @route   GET /api/dashboards/college-admin/helpdesk
// @access  Private/CollegeAdmin
const getHelpdeskTickets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const tickets = await Complaint.find({ ...req.tenantFilter })
      .populate('submittedBy', 'name studentId email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.json({ success: true, data: tickets });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve ticket
// @route   PUT /api/dashboards/college-admin/helpdesk/:id/resolve
// @access  Private/CollegeAdmin
const resolveTicket = async (req, res, next) => {
  try {
    const ticket = await Complaint.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!ticket) {
      return next(new AppError('Complaint not found or unauthorized access.', 404));
    }
    ticket.status = 'resolved';
    ticket.resolutionMessage = req.body.resolutionMessage;
    ticket.resolvedBy = req.user.id;
    ticket.resolvedAt = new Date();
    await ticket.save();

    await notificationService.notify(
      ticket.submittedBy,
      'complaint_resolved',
      `Your complaint "${ticket.subject}" has been resolved.`,
      ticket._id,
      'Complaint'
    );

    res.locals.auditMeta = {
      targetType: 'Complaint',
      targetId: ticket._id,
      collegeId: req.user.collegeId,
      metadata: { resolutionMessage: req.body.resolutionMessage },
    };

    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Analytics Summary
// @route   GET /api/dashboards/college-admin/analytics/summary
// @access  Private/CollegeAdmin
const getAnalyticsSummary = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const tenantFilter = { ...req.tenantFilter };
    if (tenantFilter.collegeId && typeof tenantFilter.collegeId === 'string') {
      tenantFilter.collegeId = new mongoose.Types.ObjectId(tenantFilter.collegeId);
    }

    const totalStudents = await User.countDocuments({ role: 'student', ...tenantFilter });
    const activeLoans = await Loan.countDocuments({ status: 'active', ...tenantFilter });
    const overdueLoans = await Loan.countDocuments({ status: 'overdue', ...tenantFilter });

    const pendingFinesAgg = await Fine.aggregate([
      { $match: { status: 'unpaid', ...tenantFilter } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]);
    const unpaidFinesTotal = pendingFinesAgg[0] ? pendingFinesAgg[0].totalAmount : 0;

    // Most-borrowed books (top N)
    const topN = parseInt(req.query.topN, 10) || 5;
    const topBooks = await Loan.aggregate([
      { $match: { ...tenantFilter } },
      { $group: { _id: '$bookId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: topN },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'bookDetails',
        },
      },
      { $unwind: '$bookDetails' },
      {
        $project: {
          bookId: '$_id',
          count: 1,
          title: '$bookDetails.title',
          author: '$bookDetails.author',
          isbn: '$bookDetails.isbn',
        },
      },
    ]);

    // Lab Utilization Rate
    const totalSeats = await LabSeat.countDocuments({ maintenanceStatus: 'operational', ...tenantFilter });
    const totalBookings = await LabBooking.countDocuments({ status: 'booked', ...tenantFilter });
    const labUtilizationRate = totalSeats > 0 ? Number((totalBookings / totalSeats).toFixed(4)) : 0;

    // Average Resolution Time for Complaints
    const complaintsAgg = await Complaint.aggregate([
      { $match: { status: 'resolved', ...tenantFilter } },
      {
        $project: {
          resolutionTimeMs: { $subtract: ['$resolvedAt', '$createdAt'] },
        },
      },
      {
        $group: {
          _id: null,
          avgResolutionTimeMs: { $avg: '$resolutionTimeMs' },
        },
      },
    ]);
    const avgComplaintResolutionHours = complaintsAgg.length > 0
      ? Number((complaintsAgg[0].avgResolutionTimeMs / (1000 * 60 * 60)).toFixed(2))
      : 0;

    // Catalog Size vs Digital Resource Count
    const catalogSize = await Book.countDocuments({ ...tenantFilter });
    const digitalResourceCount = await EResource.countDocuments({ moderationStatus: 'approved', ...tenantFilter });

    res.json({
      success: true,
      data: {
        totalStudents,
        activeLoans,
        overdueLoans,
        unpaidFinesTotal,
        topBooks,
        labUtilizationRate,
        avgComplaintResolutionHours,
        catalogSize,
        digitalResourceCount,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Staff override checkout
// @route   POST /api/dashboards/college-admin/circulation/checkout
// @access  Private/CollegeAdmin
const checkoutBook = async (req, res, next) => {
  try {
    const { userId, bookId } = req.body;

    // 1. Verify target user belongs to the same collegeId as the admin
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return next(new AppError('Target user not found.', 404));
    }

    if (targetUser.collegeId.toString() !== req.user.collegeId.toString()) {
      return next(
        new AppError('Cross-tenant checkout rejected. User belongs to another institution.', 403)
      );
    }

    // 2. Call service layer
    const loan = await loanService.checkoutBook(
      userId,
      bookId,
      req.user.collegeId,
      req.user.id // Issued by admin ID
    );

    res.locals.auditMeta = {
      targetType: 'Loan',
      targetId: loan._id,
      collegeId: req.user.collegeId,
      metadata: { userId, bookId },
    };

    res.status(201).json({
      success: true,
      data: loan,
      message: 'Book successfully checked out.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Staff override return
// @route   POST /api/dashboards/college-admin/circulation/return
// @access  Private/CollegeAdmin
const returnBook = async (req, res, next) => {
  try {
    const { loanId } = req.body;

    const loan = await loanService.returnBook(loanId, req.user.collegeId);

    res.locals.auditMeta = {
      targetType: 'Loan',
      targetId: loan._id,
      collegeId: req.user.collegeId,
      metadata: { loanId },
    };

    res.json({
      success: true,
      data: loan,
      message: 'Book successfully returned.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current hold queues
// @route   GET /api/dashboards/college-admin/circulation/queue
// @access  Private/CollegeAdmin
const getCirculationQueue = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const queue = await Reservation.find({
      ...req.tenantFilter,
      status: { $in: ['queued', 'ready_for_pickup'] },
    })
      .populate('bookId', 'title author isbn')
      .populate('userId', 'name email studentId')
      .sort('queuePosition')
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all college fines
// @route   GET /api/dashboards/college-admin/fines
// @access  Private/CollegeAdmin
const getCollegeFines = async (req, res, next) => {
  try {
    const { status } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const filter = { ...req.tenantFilter };
    if (status) {
      filter.status = status;
    }

    const fines = await Fine.find(filter)
      .populate('userId', 'name email studentId')
      .populate({
        path: 'loanId',
        populate: { path: 'bookId', select: 'title author' },
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: fines,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pay fine
// @route   POST /api/dashboards/college-admin/fines/:id/pay
// @access  Private/CollegeAdmin
const payCollegeFine = async (req, res, next) => {
  try {
    const fine = await Fine.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!fine) {
      return next(new AppError('Fine not found or unauthorized access.', 404));
    }

    if (fine.status === 'paid') {
      return next(new AppError('This fine has already been paid.', 400));
    }

    fine.status = 'paid';
    fine.paidAt = new Date();
    await fine.save();

    res.locals.auditMeta = {
      targetType: 'Fine',
      targetId: fine._id,
      collegeId: req.user.collegeId,
      metadata: { fineId: fine._id, amount: fine.amount },
    };

    res.json({
      success: true,
      data: fine,
      message: 'Fine payment successfully processed.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending e-resources for moderation
// @route   GET /api/dashboards/college-admin/eresources/pending
// @access  Private/CollegeAdmin
const getPendingEResources = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const resources = await EResource.find({
      ...req.tenantFilter,
      moderationStatus: 'pending',
    })
      .populate('uploadedBy', 'name email studentId')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: resources,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Moderate e-resource submission
// @route   PUT /api/dashboards/college-admin/eresources/:id/moderate
// @access  Private/CollegeAdmin
const moderateEResource = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    const resource = await EResource.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!resource) {
      return next(new AppError('Resource not found or unauthorized access.', 404));
    }

    resource.moderationStatus = status;
    resource.moderationNote = note || '';
    resource.moderatedBy = req.user.id;
    resource.moderatedAt = new Date();
    await resource.save();

    res.json({
      success: true,
      data: resource,
      message: `Resource successfully ${status}.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStudent,
  getAllPatrons,
  getPatronDetails,
  addBook,
  updateBook,
  uploadCollegeResource,
  getHelpdeskTickets,
  resolveTicket,
  getAnalyticsSummary,
  checkoutBook,
  returnBook,
  getCirculationQueue,
  getCollegeFines,
  payCollegeFine,
  getPendingEResources,
  moderateEResource,
};

// @desc    Get all lab seats for college
// @route   GET /api/dashboards/college-admin/lab-seats
// @access  Private/CollegeAdmin
const getLabSeats = async (req, res, next) => {
  try {
    const seats = await LabSeat.find({ ...req.tenantFilter });
    res.json({ success: true, data: seats });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new lab seat
// @route   POST /api/dashboards/college-admin/lab-seats
// @access  Private/CollegeAdmin
const createLabSeat = async (req, res, next) => {
  try {
    const seat = await LabSeat.create({
      ...req.body,
      collegeId: req.user.collegeId,
    });

    res.locals.auditMeta = {
      targetType: 'LabSeat',
      targetId: seat._id,
      collegeId: req.user.collegeId,
      metadata: req.body,
    };

    res.status(201).json({ success: true, data: seat });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lab seat (specs/maintenance status)
// @route   PUT /api/dashboards/college-admin/lab-seats/:id
// @access  Private/CollegeAdmin
const updateLabSeat = async (req, res, next) => {
  try {
    const seat = await LabSeat.findOneAndUpdate(
      { _id: req.params.id, ...req.tenantFilter },
      req.body,
      { new: true }
    );
    if (!seat) {
      return next(new AppError('Lab seat not found or unauthorized access.', 404));
    }

    res.locals.auditMeta = {
      targetType: 'LabSeat',
      targetId: seat._id,
      collegeId: req.user.collegeId,
      metadata: req.body,
    };

    res.json({ success: true, data: seat });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all lab bookings for college
// @route   GET /api/dashboards/college-admin/lab-bookings
// @access  Private/CollegeAdmin
const getLabBookings = async (req, res, next) => {
  try {
    const { date, labName } = req.query;
    const filter = { ...req.tenantFilter };

    if (date) {
      const d = new Date(date);
      filter.date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    if (labName) {
      const seats = await LabSeat.find({ labName, ...req.tenantFilter });
      filter.seatId = { $in: seats.map((s) => s._id) };
    }

    const bookings = await LabBooking.find(filter)
      .populate('seatId')
      .populate('userId', 'name studentId email')
      .sort({ startTime: -1 });

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all book suggestions
// @route   GET /api/dashboards/college-admin/book-suggestions
// @access  Private/CollegeAdmin
const getBookSuggestions = async (req, res, next) => {
  try {
    const suggestions = await BookSuggestion.find({ ...req.tenantFilter })
      .populate('suggestedBy', 'name studentId email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
};

// @desc    Update book suggestion status/admin note
// @route   PUT /api/dashboards/college-admin/book-suggestions/:id
// @access  Private/CollegeAdmin
const updateBookSuggestion = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const suggestion = await BookSuggestion.findOne({ _id: req.params.id, ...req.tenantFilter });
    if (!suggestion) {
      return next(new AppError('Book suggestion not found or unauthorized access.', 404));
    }

    suggestion.status = status;
    if (adminNote !== undefined) {
      suggestion.adminNote = adminNote;
    }
    await suggestion.save();

    res.locals.auditMeta = {
      targetType: 'BookSuggestion',
      targetId: suggestion._id,
      collegeId: req.user.collegeId,
      metadata: { status, adminNote },
    };

    res.json({ success: true, data: suggestion });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all feedback for college
// @route   GET /api/dashboards/college-admin/feedback
// @access  Private/CollegeAdmin
const getFeedback = async (req, res, next) => {
  try {
    const { category, rating } = req.query;
    const filter = { ...req.tenantFilter };

    if (category) {
      filter.category = category;
    }
    if (rating) {
      filter.rating = parseInt(rating, 10);
    }

    const feedbacks = await Feedback.find(filter)
      .populate('submittedBy', 'name studentId email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: feedbacks });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStudent,
  getAllPatrons,
  getPatronDetails,
  addBook,
  updateBook,
  uploadCollegeResource,
  getHelpdeskTickets,
  resolveTicket,
  getAnalyticsSummary,
  checkoutBook,
  returnBook,
  getCirculationQueue,
  getCollegeFines,
  payCollegeFine,
  getPendingEResources,
  moderateEResource,
  getLabSeats,
  createLabSeat,
  updateLabSeat,
  getLabBookings,
  getBookSuggestions,
  updateBookSuggestion,
  getFeedback,
};
