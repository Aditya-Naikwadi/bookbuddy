const Fine = require('../models/Fine');
const asyncHandler = require('../utils/asyncHandler');
const tenantScope = require('../utils/tenantScope');
const { payFine: payFineService, payAllFines } = require('../services/fineService');

// @desc    Get user's fines
// @route   GET /api/fines/me
// @access  Private
const getMyFines = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Tenant scoping wrapper
  const fineRepo = tenantScope(Fine, req);

  const total = await fineRepo.countDocuments({ userId: req.user.id });
  const fines = await fineRepo
    .find({ userId: req.user.id })
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
  const fineRepo = tenantScope(Fine, req);
  const fines = await fineRepo.find({ userId: req.user.id, status: 'unpaid' });

  const totalUnpaid = fines.reduce((acc, fine) => acc + fine.amount, 0);

  res.json({ success: true, data: { totalUnpaid, unpaidCount: fines.length } });
});

// @desc    Pay a fine
// @route   POST /api/fines/:id/pay
// @access  Private
const payFineHandler = asyncHandler(async (req, res) => {
  const { useWaiver } = req.body;
  const fine = await payFineService(req.params.id, req.user.id, req.user.collegeId, useWaiver);
  res.json({ success: true, data: fine });
});

// @desc    Pay all fines
// @route   POST /api/fines/pay-all
// @access  Private
const payAllFinesHandler = asyncHandler(async (req, res) => {
  const result = await payAllFines(req.user.id, req.user.collegeId);
  res.json({ success: true, data: result });
});

module.exports = {
  getMyFines,
  getMyFinesSummary,
  payFine: payFineHandler,
  payAllFines: payAllFinesHandler,
};
