// Controller managing student-specific dashboard catalog actions, loans, holds, fines, and digital/personalization services.
const Book = require('../../models/Book');
const Loan = require('../../models/Loan');
const Fine = require('../../models/Fine');
const config = require('../../config');
const EResource = require('../../models/EResource');
const ReadingList = require('../../models/ReadingList');
const ReadingProgress = require('../../models/ReadingProgress');
const Bookmark = require('../../models/Bookmark');
const SavedSearch = require('../../models/SavedSearch');
const LabBooking = require('../../models/LabBooking');
const BookSuggestion = require('../../models/BookSuggestion');
const Feedback = require('../../models/Feedback');
const Complaint = require('../../models/Complaint');
const UserSticker = require('../../models/UserSticker');
const NotificationPreference = require('../../models/NotificationPreference');
const Reservation = require('../../models/Reservation');
const loanService = require('../../services/loanService');
const reservationService = require('../../services/reservationService');
const labBookingService = require('../../services/labBookingService');
const notificationService = require('../../services/notificationService');
const streakService = require('../../services/streakService');
const { getApprovedResourcesFilter } = require('../../services/eresourceService');
const { assertOwner } = require('../../services/ownershipService');
const AppError = require('../../utils/AppError');

// ==========================================
// Catalog & OPAC Controllers
// ==========================================

// @desc    Get college catalog books
// @route   GET /api/dashboards/student/catalog
// @access  Private/Student
const getStudentCatalog = async (req, res, next) => {
  try {
    const { query, category, format, availability, sortBy, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const filter = { ...req.tenantFilter };

    if (query) {
      filter.$text = { $search: query };
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (format && format !== 'all') {
      filter.format = format;
    }
    if (availability === 'available') {
      filter.copiesAvailable = { $gt: 0 };
    } else if (availability === 'checked-out') {
      filter.copiesAvailable = 0;
    }

    let sortOptions = { title: 1 }; // Default alphabetical
    if (sortBy === 'newest') {
      sortOptions = { createdAt: -1 };
    } else if (sortBy === 'title') {
      sortOptions = { title: 1 };
    } else if (sortBy === 'relevance' && query) {
      sortOptions = { score: { $meta: 'textScore' } };
    }

    const booksQuery = Book.find(filter);
    if (sortBy === 'relevance' && query) {
      booksQuery.select({ score: { $meta: 'textScore' } });
    }

    const books = await booksQuery
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select('-__v');

    const total = await Book.countDocuments(filter);

    res.json({
      success: true,
      data: books,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get placeholder catalog recommendations
// @route   GET /api/dashboards/student/catalog/recommendations
// @access  Private/Student
const getStudentRecommendations = async (req, res, next) => {
  try {
    const recentLoan = await Loan.findOne({ userId: req.user.id })
      .sort('-createdAt')
      .populate('bookId');

    const filter = { ...req.tenantFilter };
    if (recentLoan && recentLoan.bookId) {
      filter.category = recentLoan.bookId.category;
    }

    const recommendations = await Book.find(filter).limit(5);

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Circulation & Holds Controllers
// ==========================================

// @desc    Get student loans (active + returned)
// @route   GET /api/dashboards/student/loans
// @access  Private/Student
const getStudentLoans = async (req, res, next) => {
  try {
    const loans = await Loan.find({ userId: req.user.id })
      .populate('bookId', 'title author isbn coverImage')
      .sort('-createdAt');

    // Calculate unpaid fine total
    const unpaidFines = await Fine.find({ userId: req.user.id, status: 'unpaid' });
    const totalUnpaidFine = unpaidFines.reduce((sum, f) => sum + f.amount, 0);
    const maxFineLimit = config.unpaidFineLimit || 100;

    const activeLoans = [];
    const historyLoans = [];

    for (const loan of loans) {
      if (loan.status === 'active' || loan.status === 'overdue') {
        // Calculate renewal eligibility
        let eligible = true;
        let reason = null;

        if (totalUnpaidFine > maxFineLimit) {
          eligible = false;
          reason = `Blocked: ₹${totalUnpaidFine.toFixed(2)} unpaid fines exceed the ₹${maxFineLimit} limit`;
        } else if (loan.renewalCount >= loan.maxRenewals) {
          eligible = false;
          reason = 'limit_reached';
        } else {
          // Check if anyone else has a reservation hold on this book
          const hasQueue = await Reservation.exists({
            bookId: loan.bookId,
            status: { $in: ['queued', 'ready_for_pickup'] },
          });
          if (hasQueue) {
            eligible = false;
            reason = 'on_hold';
          }
        }

        const loanObj = loan.toObject();
        loanObj.renewalEligibility = { eligible, reason };
        activeLoans.push(loanObj);
      } else {
        historyLoans.push(loan);
      }
    }

    res.json({
      success: true,
      data: {
        active: activeLoans,
        history: historyLoans,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Renew student loan
// @route   POST /api/dashboards/student/loans/:id/renew
// @access  Private/Student
const renewStudentLoan = async (req, res, next) => {
  try {
    const loan = await loanService.renewLoan(req.params.id, req.user.id, req.user.collegeId);
    res.json({
      success: true,
      data: loan,
      message: 'Loan successfully renewed.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Place reservation hold
// @route   POST /api/dashboards/student/reservations
// @access  Private/Student
const placeStudentHold = async (req, res, next) => {
  try {
    const { bookId } = req.body;
    const reservation = await reservationService.placeHold(req.user.id, bookId, req.user.collegeId);
    res.status(201).json({
      success: true,
      data: reservation,
      message: `Hold placed successfully. Queue position: ${reservation.queuePosition}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student queue position
// @route   GET /api/dashboards/student/reservations/queue
// @access  Private/Student
const getStudentQueuePosition = async (req, res, next) => {
  try {
    const { bookId } = req.query;
    const position = await reservationService.getQueuePosition(req.user.id, bookId);

    if (position === null) {
      return next(new AppError('No active hold found for this book.', 404));
    }

    res.json({
      success: true,
      data: { queuePosition: position },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student fines (unpaid + paid)
// @route   GET /api/dashboards/student/fines
// @access  Private/Student
const getStudentFines = async (req, res, next) => {
  try {
    const fines = await Fine.find({ userId: req.user.id }).populate('loanId').sort('-createdAt');

    res.json({
      success: true,
      data: fines,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Digital Assets (EResource) Controllers
// ==========================================

// @desc    Get approved e-resources
// @route   GET /api/dashboards/student/eresources
// @access  Private/Student
const getStudentEResources = async (req, res, next) => {
  try {
    const { type, category, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Filter strictly using the approved resources filter (moderationStatus: approved + tenant)
    const filter = getApprovedResourcesFilter(req.tenantFilter);

    if (type) {
      filter.type = type;
    }
    if (category) {
      filter.category = category;
    }

    const resources = await EResource.find(filter)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .sort('-createdAt');

    const total = await EResource.countDocuments(filter);

    res.json({
      success: true,
      data: resources,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single e-resource details
// @route   GET /api/dashboards/student/eresources/:id
// @access  Private/Student
const getStudentEResourceDetails = async (req, res, next) => {
  try {
    const resource = await EResource.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!resource) {
      return next(new AppError('Resource not found.', 404));
    }

    // Hide pending/rejected resources from other students (uploader can view pending status)
    if (
      resource.moderationStatus !== 'approved' &&
      resource.uploadedBy.toString() !== req.user.id.toString()
    ) {
      return next(new AppError('Resource not found.', 404));
    }

    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload/propose new e-resource
// @route   POST /api/dashboards/student/eresources
// @access  Private/Student
const uploadStudentEResource = async (req, res, next) => {
  try {
    const { title, author, type, fileUrl, category } = req.body;

    const resource = await EResource.create({
      collegeId: req.user.collegeId,
      title,
      author,
      type,
      fileUrl,
      uploadedBy: req.user.id,
      moderationStatus: 'pending',
      category,
    });

    res.status(201).json({
      success: true,
      data: resource,
      message: 'Resource successfully submitted and is pending moderation.',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Reading List Controllers
// ==========================================

// @desc    Get my reading lists, plus public lists in same college
// @route   GET /api/dashboards/student/reading-lists
// @access  Private/Student
const getStudentReadingLists = async (req, res, next) => {
  try {
    const lists = await ReadingList.find({
      $or: [{ ownerId: req.user.id }, { collegeId: req.user.collegeId, visibility: 'public' }],
    }).sort('-createdAt');

    res.json({
      success: true,
      data: lists,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single reading list details
// @route   GET /api/dashboards/student/reading-lists/:id
// @access  Private/Student
const getStudentReadingListDetails = async (req, res, next) => {
  try {
    const list = await ReadingList.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!list) {
      return next(new AppError('Reading list not found.', 404));
    }

    // Access control: if private, only the owner can read
    if (list.visibility === 'private' && list.ownerId.toString() !== req.user.id.toString()) {
      return next(new AppError('Reading list not found.', 404));
    }

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new reading list
// @route   POST /api/dashboards/student/reading-lists
// @access  Private/Student
const createStudentReadingList = async (req, res, next) => {
  try {
    const { title, description, visibility } = req.body;

    const list = await ReadingList.create({
      collegeId: req.user.collegeId,
      ownerId: req.user.id,
      title,
      description,
      visibility,
    });

    res.status(201).json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update reading list
// @route   PUT /api/dashboards/student/reading-lists/:id
// @access  Private/Student
const updateStudentReadingList = async (req, res, next) => {
  try {
    const list = await ReadingList.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!list) {
      return next(new AppError('Reading list not found.', 404));
    }

    assertOwner(list, req.user.id);

    const { title, description, visibility } = req.body;
    if (title !== undefined) list.title = title;
    if (description !== undefined) list.description = description;
    if (visibility !== undefined) list.visibility = visibility;

    await list.save();

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete reading list
// @route   DELETE /api/dashboards/student/reading-lists/:id
// @access  Private/Student
const deleteStudentReadingList = async (req, res, next) => {
  try {
    const list = await ReadingList.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!list) {
      return next(new AppError('Reading list not found.', 404));
    }

    assertOwner(list, req.user.id);

    await list.deleteOne();

    res.json({
      success: true,
      message: 'Reading list deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to reading list
// @route   POST /api/dashboards/student/reading-lists/:id/items
// @access  Private/Student
const addReadingListItem = async (req, res, next) => {
  try {
    const list = await ReadingList.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!list) {
      return next(new AppError('Reading list not found.', 404));
    }

    assertOwner(list, req.user.id);

    const { resourceType, resourceId } = req.body;

    // Check duplicate
    const exists = list.items.some(
      (item) =>
        item.resourceId.toString() === resourceId.toString() && item.resourceType === resourceType
    );
    if (exists) {
      return next(new AppError('Resource already exists in this reading list.', 400));
    }

    list.items.push({
      resourceType,
      resourceId,
      addedAt: new Date(),
    });

    await list.save();

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete item from reading list
// @route   DELETE /api/dashboards/student/reading-lists/:id/items/:itemId
// @access  Private/Student
const deleteReadingListItem = async (req, res, next) => {
  try {
    const list = await ReadingList.findOne({ _id: req.params.id, ...req.tenantFilter });

    if (!list) {
      return next(new AppError('Reading list not found.', 404));
    }

    assertOwner(list, req.user.id);

    const originalLength = list.items.length;
    list.items = list.items.filter((item) => item._id.toString() !== req.params.itemId.toString());

    if (list.items.length === originalLength) {
      return next(new AppError('Item not found in reading list.', 404));
    }

    await list.save();

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Reading Progress Controllers
// ==========================================

// @desc    Get reading progress for e-resource
// @route   GET /api/dashboards/student/reading-progress/:eresourceId
// @access  Private/Student
const getReadingProgress = async (req, res, next) => {
  try {
    const progress = await ReadingProgress.findOne({
      userId: req.user.id,
      eresourceId: req.params.eresourceId,
    });

    if (!progress) {
      return next(new AppError('No reading progress record found.', 404));
    }

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upsert reading progress
// @route   PUT /api/dashboards/student/reading-progress/:eresourceId
// @access  Private/Student
const upsertReadingProgress = async (req, res, next) => {
  try {
    const { eresourceId } = req.params;
    const { currentPage, epubProgress } = req.body;

    const progress = await ReadingProgress.findOneAndUpdate(
      { userId: req.user.id, eresourceId },
      {
        $set: {
          currentPage,
          epubProgress,
          lastReadAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Bookmarks Controllers
// ==========================================

// @desc    Get user bookmarks
// @route   GET /api/dashboards/student/bookmarks
// @access  Private/Student
const getStudentBookmarks = async (req, res, next) => {
  try {
    const { eresourceId } = req.query;

    const filter = { userId: req.user.id };
    if (eresourceId) {
      filter.eresourceId = eresourceId;
    }

    const bookmarks = await Bookmark.find(filter).sort('-createdAt');

    res.json({
      success: true,
      data: bookmarks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create bookmark
// @route   POST /api/dashboards/student/bookmarks
// @access  Private/Student
const createStudentBookmark = async (req, res, next) => {
  try {
    const { eresourceId, locationRef, note } = req.body;

    const bookmark = await Bookmark.create({
      userId: req.user.id,
      eresourceId,
      locationRef,
      note,
    });

    res.status(201).json({
      success: true,
      data: bookmark,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete bookmark
// @route   DELETE /api/dashboards/student/bookmarks/:id
// @access  Private/Student
const deleteStudentBookmark = async (req, res, next) => {
  try {
    const bookmark = await Bookmark.findById(req.params.id);

    if (!bookmark) {
      return next(new AppError('Bookmark not found.', 404));
    }

    assertOwner(bookmark, req.user.id);

    await bookmark.deleteOne();

    res.json({
      success: true,
      message: 'Bookmark successfully deleted.',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Saved Searches Controllers
// ==========================================

// @desc    Get saved searches
// @route   GET /api/dashboards/student/saved-searches
// @access  Private/Student
const getStudentSavedSearches = async (req, res, next) => {
  try {
    const searches = await SavedSearch.find({ userId: req.user.id }).sort('-createdAt');

    res.json({
      success: true,
      data: searches,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save search parameters
// @route   POST /api/dashboards/student/saved-searches
// @access  Private/Student
const saveStudentSearch = async (req, res, next) => {
  try {
    const { queryParams, alertsEnabled } = req.body;

    const search = await SavedSearch.create({
      userId: req.user.id,
      collegeId: req.user.collegeId,
      queryParams,
      alertsEnabled,
    });

    res.status(201).json({
      success: true,
      data: search,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete saved search
// @route   DELETE /api/dashboards/student/saved-searches/:id
// @access  Private/Student
const deleteStudentSearch = async (req, res, next) => {
  try {
    const search = await SavedSearch.findById(req.params.id);

    if (!search) {
      return next(new AppError('Saved search not found.', 404));
    }

    assertOwner(search, req.user.id);

    await search.deleteOne();

    res.json({
      success: true,
      message: 'Saved search successfully deleted.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle alert status on saved search
// @route   PATCH /api/dashboards/student/saved-searches/:id/alerts
// @access  Private/Student
const toggleSavedSearchAlerts = async (req, res, next) => {
  try {
    const search = await SavedSearch.findById(req.params.id);

    if (!search) {
      return next(new AppError('Saved search not found.', 404));
    }

    assertOwner(search, req.user.id);

    search.alertsEnabled = req.body.alertsEnabled;
    await search.save();

    res.json({
      success: true,
      data: search,
      message: 'Saved search alert preference updated.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lab seats availability
// @route   GET /api/dashboards/student/labs/availability
// @access  Private/Student
const getLabsAvailability = async (req, res, next) => {
  try {
    const { labName, date } = req.query;
    const availability = await labBookingService.getAvailability(req.user.collegeId, labName, date);
    res.json({ success: true, data: availability });
  } catch (error) {
    next(error);
  }
};

// @desc    Book a lab timeslot
// @route   POST /api/dashboards/student/lab-bookings
// @access  Private/Student
const createLabBooking = async (req, res, next) => {
  try {
    const { seatId, startTime, endTime } = req.body;
    const result = await labBookingService.createBooking(
      req.user.id,
      seatId,
      req.user.collegeId,
      startTime,
      endTime
    );
    res.status(201).json({ success: true, data: result.booking, streak: result.streakData });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel lab timeslot booking
// @route   DELETE /api/dashboards/student/lab-bookings/:id
// @access  Private/Student
const cancelLabBooking = async (req, res, next) => {
  try {
    const booking = await labBookingService.cancelBooking(
      req.params.id,
      req.user.id,
      req.user.role
    );
    res.json({ success: true, data: booking, message: 'Booking cancelled successfully.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's own lab bookings
// @route   GET /api/dashboards/student/lab-bookings
// @access  Private/Student
const getStudentLabBookings = async (req, res, next) => {
  try {
    const bookings = await LabBooking.find({
      userId: req.user.id,
      ...req.tenantFilter,
    })
      .populate('seatId')
      .sort({ startTime: -1 });

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit book suggestion
// @route   POST /api/dashboards/student/book-suggestions
// @access  Private/Student
const createBookSuggestion = async (req, res, next) => {
  try {
    const { title, author, reason } = req.body;
    const suggestion = await BookSuggestion.create({
      collegeId: req.user.collegeId,
      suggestedBy: req.user.id,
      title,
      author,
      reason,
      status: 'pending',
    });
    res.status(201).json({ success: true, data: suggestion });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's own book suggestions
// @route   GET /api/dashboards/student/book-suggestions
// @access  Private/Student
const getStudentBookSuggestions = async (req, res, next) => {
  try {
    const suggestions = await BookSuggestion.find({
      suggestedBy: req.user.id,
      ...req.tenantFilter,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit general feedback
// @route   POST /api/dashboards/student/feedback
// @access  Private/Student
const createFeedback = async (req, res, next) => {
  try {
    const { category, message, rating } = req.body;
    const feedback = await Feedback.create({
      collegeId: req.user.collegeId,
      submittedBy: req.user.id,
      category,
      message,
      rating,
    });
    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit helpdesk complaint
// @route   POST /api/dashboards/student/complaints
// @access  Private/Student
const createComplaint = async (req, res, next) => {
  try {
    const { subject, description } = req.body;
    const complaint = await Complaint.create({
      collegeId: req.user.collegeId,
      submittedBy: req.user.id,
      subject,
      description,
      status: 'open',
    });
    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's own complaints
// @route   GET /api/dashboards/student/complaints
// @access  Private/Student
const getStudentComplaints = async (req, res, next) => {
  try {
    const complaints = await Complaint.find({
      submittedBy: req.user.id,
      ...req.tenantFilter,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: complaints });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current student streak status
// @route   GET /api/dashboards/student/streak
// @access  Private/Student
const getStudentStreak = async (req, res, next) => {
  try {
    const streak = await streakService.getOrCreateStreak(req.user.id, req.user.collegeId);
    res.json({
      success: true,
      data: {
        currentStreak: streak.currentStreak,
        maxStreak: streak.maxStreak,
        freezesAvailable: streak.freezesAvailable,
        lastQualifyingActionAt: streak.lastQualifyingActionAt,
        timezone: streak.timezone,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's earned stickers
// @route   GET /api/dashboards/student/stickers
// @access  Private/Student
const getStudentStickers = async (req, res, next) => {
  try {
    const stickers = await UserSticker.find({ userId: req.user.id })
      .populate('stickerId')
      .sort({ earnedAt: -1 });
    res.json({ success: true, data: stickers });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's own notifications
// @route   GET /api/dashboards/student/notifications
// @access  Private/Student
const getStudentNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getMyNotifications(req.user.id, {
      read: req.query.read,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a notification as read
// @route   PATCH /api/dashboards/student/notifications/:id/read
// @access  Private/Student
const readStudentNotification = async (req, res, next) => {
  try {
    const notification = await notificationService.markRead(req.params.id, req.user.id);
    res.json({ success: true, data: notification, message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's notification preferences
// @route   GET /api/dashboards/student/notification-preferences
// @access  Private/Student
const getNotificationPreferences = async (req, res, next) => {
  try {
    let pref = await NotificationPreference.findOne({ userId: req.user.id });
    if (!pref) {
      pref = await NotificationPreference.create({
        userId: req.user.id,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        typePreferences: {},
      });
    }
    res.json({ success: true, data: pref });
  } catch (error) {
    next(error);
  }
};

// @desc    Update student's notification preferences
// @route   PUT /api/dashboards/student/notification-preferences
// @access  Private/Student
const updateNotificationPreferences = async (req, res, next) => {
  try {
    const { emailEnabled, pushEnabled, inAppEnabled, typePreferences } = req.body;
    let pref = await NotificationPreference.findOne({ userId: req.user.id });
    if (!pref) {
      pref = new NotificationPreference({ userId: req.user.id });
    }

    if (emailEnabled !== undefined) pref.emailEnabled = emailEnabled;
    if (pushEnabled !== undefined) pref.pushEnabled = pushEnabled;
    if (inAppEnabled !== undefined) pref.inAppEnabled = inAppEnabled;

    if (typePreferences !== undefined) {
      for (const [key, value] of Object.entries(typePreferences)) {
        pref.typePreferences.set(key, value);
      }
    }

    await pref.save();
    res.json({ success: true, data: pref, message: 'Notification preferences updated.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get aggregated student dashboard overview (Fast single-query payload)
// @route   GET /api/dashboards/student/overview
// @access  Private/Student
const getStudentOverview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const collegeId = req.user.collegeId;

    // Run parallel lightweight database queries using .lean()
    const [
      loans,
      unpaidFines,
      reservations,
      streak,
      recentReadingProgress,
      recommendations,
      unreadNotificationsCount,
    ] = await Promise.all([
      Loan.find({ userId, status: { $in: ['active', 'overdue'] } })
        .populate('bookId', 'title author isbn category format coverImage')
        .sort('-createdAt')
        .lean(),

      Fine.find({ userId, status: 'unpaid' }).lean(),

      Reservation.find({ userId, status: { $in: ['queued', 'ready_for_pickup'] } })
        .populate('bookId', 'title author category coverImage')
        .sort('-createdAt')
        .lean(),

      streakService.getOrCreateStreak(userId, collegeId),

      ReadingProgress.findOne({ userId })
        .sort('-lastReadAt')
        .populate('eresourceId', 'title author type format coverUrl')
        .lean(),

      Book.find({ ...req.tenantFilter })
        .select('title author category coverImage copiesAvailable maxLoanDays rating')
        .sort('-createdAt')
        .limit(6)
        .lean(),

      notificationService
        .getMyNotifications(userId, { read: 'false', limit: 1 })
        .then((r) => r.total || 0)
        .catch(() => 0),
    ]);

    // Batch query reservation holds for active loan books (Solves N+1 query loop)
    const bookIds = loans.map((l) => l.bookId?._id || l.bookId).filter(Boolean);
    let heldBookIdsSet = new Set();
    if (bookIds.length > 0) {
      const queuedHolds = await Reservation.find({
        bookId: { $in: bookIds },
        status: { $in: ['queued', 'ready_for_pickup'] },
      })
        .select('bookId')
        .lean();
      heldBookIdsSet = new Set(queuedHolds.map((h) => (h.bookId ? h.bookId.toString() : '')));
    }

    const totalUnpaidFine = unpaidFines.reduce((sum, f) => sum + (f.amount || 0), 0);
    const maxFineLimit = config.unpaidFineLimit || 100;

    const activeLoans = loans.map((loan) => {
      let eligible = true;
      let reason = null;

      if (totalUnpaidFine > maxFineLimit) {
        eligible = false;
        reason = `Blocked: ₹${totalUnpaidFine.toFixed(2)} unpaid fines exceed the ₹${maxFineLimit} limit`;
      } else if (loan.renewalCount >= (loan.maxRenewals || 2)) {
        eligible = false;
        reason = 'limit_reached';
      } else if (
        loan.bookId &&
        heldBookIdsSet.has(loan.bookId._id ? loan.bookId._id.toString() : loan.bookId.toString())
      ) {
        eligible = false;
        reason = 'on_hold';
      }

      return {
        ...loan,
        renewalEligibility: { eligible, reason },
      };
    });

    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          studentId: req.user.studentId || req.user.idNumber || 'STU-1001',
          role: req.user.role,
          collegeId: req.user.collegeId,
        },
        activeLoans,
        finesSummary: {
          totalUnpaid: totalUnpaidFine,
          unpaidCount: unpaidFines.length,
        },
        reservations,
        streak: {
          currentStreak: streak?.currentStreak || 0,
          maxStreak: streak?.maxStreak || 0,
          freezesAvailable: streak?.freezesAvailable || 0,
          lastQualifyingActionAt: streak?.lastQualifyingActionAt,
          todayComplete: streak?.lastQualifyingActionAt
            ? new Date(streak.lastQualifyingActionAt).toDateString() === new Date().toDateString()
            : false,
        },
        recentReadingProgress,
        recommendations,
        unreadNotificationsCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const analyticsCacheMap = new Map();
const ANALYTICS_CACHE_TTL = 60 * 1000; // 60 seconds

// @desc    Get historical reading analytics for last 7/30 days
// @route   GET /api/dashboards/student/reading-analytics
// @access  Private/Student
const getStudentReadingAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const range = req.query.range || req.query.days;
    const days = range === 'month' || parseInt(range, 10) === 30 ? 30 : 7;
    const cacheKey = `${userId}:${days}`;

    // Check cache hit
    const cached = analyticsCacheMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ANALYTICS_CACHE_TTL) {
      return res.json({
        success: true,
        data: cached.data,
      });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (days - 1));
    const startDateStr = startDate.toISOString().split('T')[0];

    const ReadingActivityLog = require('../../models/ReadingActivityLog');
    const logs = await ReadingActivityLog.find({
      userId,
      date: { $gte: startDateStr },
    }).lean();

    const logsByDate = new Map();
    logs.forEach((l) => logsByDate.set(l.date, l));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const analytics = [];
    let totalPagesRead = 0;
    let totalMinutesRead = 0;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(endDate.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = dayNames[d.getDay()];

      const activity = logsByDate.get(dateStr);
      const pagesRead = activity ? activity.pagesRead || 0 : 0;
      const minutesRead = activity ? activity.minutesRead || 0 : 0;

      totalPagesRead += pagesRead;
      totalMinutesRead += minutesRead;

      analytics.push({
        date: dateStr,
        day: dayLabel,
        pagesRead,
        minutesRead,
      });
    }

    const isEmpty = totalPagesRead === 0 && totalMinutesRead === 0;

    const responseData = {
      days,
      isEmpty,
      totalPagesRead,
      totalMinutesRead,
      analytics,
    };

    // Store in cache
    analyticsCacheMap.set(cacheKey, { timestamp: Date.now(), data: responseData });

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentReadingAnalytics,
  getStudentOverview,
  getStudentCatalog,
  getStudentRecommendations,
  getStudentLoans,
  renewStudentLoan,
  placeStudentHold,
  getStudentQueuePosition,
  getStudentFines,
  getStudentEResources,
  getStudentEResourceDetails,
  uploadStudentEResource,
  getStudentReadingLists,
  getStudentReadingListDetails,
  createStudentReadingList,
  updateStudentReadingList,
  deleteStudentReadingList,
  addReadingListItem,
  deleteReadingListItem,
  getReadingProgress,
  upsertReadingProgress,
  getStudentBookmarks,
  createStudentBookmark,
  deleteStudentBookmark,
  getStudentSavedSearches,
  saveStudentSearch,
  deleteStudentSearch,
  toggleSavedSearchAlerts,
  getLabsAvailability,
  createLabBooking,
  cancelLabBooking,
  getStudentLabBookings,
  createBookSuggestion,
  getStudentBookSuggestions,
  createFeedback,
  createComplaint,
  getStudentComplaints,
  getStudentStreak,
  getStudentStickers,
  getStudentNotifications,
  readStudentNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
};
