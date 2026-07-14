const Fine = require('../models/Fine');
const asyncHandler = require('../utils/asyncHandler');
const { payFine: payFineService } = require('../services/fineService');

// @desc    Get user's fines
// @route   GET /api/fines/me
// @access  Private
const getMyFines = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await Fine.countDocuments({ userId: req.user._id });
  const fines = await Fine.find({ userId: req.user._id })
    .populate({
      path: 'loanId',
      populate: {
        path: 'bookId',
        select: 'title',
      },
    })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: fines,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc    Get fines summary (total unpaid, etc.)
// @route   GET /api/fines/me/summary
// @access  Private
const getMyFinesSummary = asyncHandler(async (req, res) => {
  const fines = await Fine.find({ userId: req.user._id, status: 'unpaid' });

  const totalUnpaid = fines.reduce((acc, fine) => acc + fine.amount, 0);

  res.json({ success: true, data: { totalUnpaid, unpaidCount: fines.length } });
});

// @desc    Pay a fine
// @route   POST /api/fines/:id/pay
// @access  Private
const payFineHandler = asyncHandler(async (req, res) => {
  const { useWaiver } = req.body;
  const fine = await payFineService(req.params.id, req.user._id, useWaiver);
  res.json({ success: true, data: fine });
});

module.exports = {
  getMyFines,
  getMyFinesSummary,
  payFine: payFineHandler,
};
