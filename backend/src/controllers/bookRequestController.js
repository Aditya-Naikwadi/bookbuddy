const BookRequest = require('../models/BookRequest');

// POST /api/v1/book-requests - Create a student book request
const createBookRequest = async (req, res, next) => {
  try {
    const { title, author, isbn, reason } = req.body;

    if (!title || !title.trim() || !author || !author.trim()) {
      return res.status(400).json({ success: false, message: 'Title and author are required.' });
    }

    // 1. Enforce 3 pending requests limit per student
    const pendingCount = await BookRequest.countDocuments({
      collegeId: req.user.collegeId,
      userId: req.user._id,
      status: 'pending',
    });

    if (pendingCount >= 3) {
      return res.status(400).json({
        success: false,
        message:
          'Maximum limit of 3 pending book requests reached. Please wait for your existing requests to be reviewed.',
      });
    }

    // 2. Case-insensitive deduplication check for pending requests by same user
    const existing = await BookRequest.findOne({
      collegeId: req.user.collegeId,
      userId: req.user._id,
      status: 'pending',
      title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
      author: { $regex: new RegExp(`^${author.trim()}$`, 'i') },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request for this title and author.',
      });
    }

    const request = await BookRequest.create({
      collegeId: req.user.collegeId,
      userId: req.user._id,
      title: title.trim(),
      author: author.trim(),
      isbn: isbn ? isbn.trim() : '',
      reason: reason ? reason.trim() : '',
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/book-requests/me - Get current student's requests
const getUserBookRequests = async (req, res, next) => {
  try {
    const requests = await BookRequest.find({
      collegeId: req.user.collegeId,
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/book-requests - Admin list all requests
const getAllBookRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { collegeId: req.user.collegeId };
    if (status) filter.status = status;

    const requests = await BookRequest.find(filter)
      .populate('userId', 'name email rollNumber department')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/book-requests/:id/status - Admin update request status
const updateBookRequestStatus = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    if (!['pending', 'approved', 'rejected', 'fulfilled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    const request = await BookRequest.findOne({
      _id: req.params.id,
      collegeId: req.user.collegeId,
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Book request not found.' });
    }

    request.status = status;
    if (adminNotes !== undefined) request.adminNotes = adminNotes;
    await request.save();

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBookRequest,
  getUserBookRequests,
  getAllBookRequests,
  updateBookRequestStatus,
};
