const ItemReport = require('../models/ItemReport');
const Loan = require('../models/Loan');

// POST /api/v1/item-reports - Create a report for a borrowed book
const createItemReport = async (req, res, next) => {
  try {
    const { loanId, issueType, description } = req.body;

    if (!loanId || !issueType || !description || !description.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'loanId, issueType, and description are required.' });
    }

    // 1. Verify loan exists and belongs to current user
    const loan = await Loan.findOne({
      _id: loanId,
      userId: req.user._id,
      collegeId: req.user.collegeId,
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: 'Borrow record not found.' });
    }

    // 2. Block reporting if item has already been returned
    if (loan.status === 'returned' || loan.returnDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot report an issue for a book that has already been returned to the library.',
      });
    }

    const report = await ItemReport.create({
      collegeId: req.user.collegeId,
      userId: req.user._id,
      loanId: loan._id,
      issueType,
      description: description.trim(),
      status: 'reported',
    });

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/item-reports/me - Get current student's item reports
const getUserItemReports = async (req, res, next) => {
  try {
    const reports = await ItemReport.find({
      collegeId: req.user.collegeId,
      userId: req.user._id,
    })
      .populate({
        path: 'loanId',
        populate: { path: 'bookId', select: 'title author coverImage isbn' },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/item-reports - Admin list all reports
const getAllItemReports = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { collegeId: req.user.collegeId };
    if (status) filter.status = status;

    const reports = await ItemReport.find(filter)
      .populate('userId', 'name email rollNumber department')
      .populate({
        path: 'loanId',
        populate: { path: 'bookId', select: 'title author coverImage isbn' },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/item-reports/:id/status - Admin update report status
const updateItemReportStatus = async (req, res, next) => {
  try {
    const { status, resolutionNotes } = req.body;
    if (!['reported', 'under_review', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    const report = await ItemReport.findOne({
      _id: req.params.id,
      collegeId: req.user.collegeId,
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Item report not found.' });
    }

    report.status = status;
    if (resolutionNotes !== undefined) report.resolutionNotes = resolutionNotes;
    await report.save();

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createItemReport,
  getUserItemReports,
  getAllItemReports,
  updateItemReportStatus,
};
