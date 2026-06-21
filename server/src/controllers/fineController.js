const Fine = require('../models/Fine');
const asyncHandler = require('express-async-handler');

// @desc    Get user's fines
// @route   GET /api/fines/me
// @access  Private
const getMyFines = asyncHandler(async (req, res) => {
  const fines = await Fine.find({ userId: req.user._id })
    .populate({
      path: 'loanId',
      populate: {
        path: 'bookId',
        select: 'title'
      }
    })
    .sort({ createdAt: -1 });

  res.json({ success: true, fines });
});

// @desc    Get fines summary (total unpaid, etc.)
// @route   GET /api/fines/me/summary
// @access  Private
const getMyFinesSummary = asyncHandler(async (req, res) => {
  const fines = await Fine.find({ userId: req.user._id, status: 'unpaid' });
  
  const totalUnpaid = fines.reduce((acc, fine) => acc + fine.amount, 0);

  res.json({ success: true, summary: { totalUnpaid, unpaidCount: fines.length } });
});

// @desc    Pay a fine
// @route   POST /api/fines/:id/pay
// @access  Private
const payFine = asyncHandler(async (req, res) => {
  const fine = await Fine.findById(req.params.id);

  if (!fine) {
    res.status(404);
    throw new Error('Fine not found');
  }

  if (fine.userId.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized for this fine');
  }

  if (fine.status !== 'unpaid') {
    res.status(400);
    throw new Error('Fine is already paid or waived');
  }

  // Simulate payment processing...
  fine.status = 'paid';
  fine.paidAt = Date.now();
  fine.paymentRef = `PAY-${Math.floor(Math.random() * 1000000)}`;

  await fine.save();

  res.json({ success: true, fine });
});

module.exports = {
  getMyFines,
  getMyFinesSummary,
  payFine,
};
