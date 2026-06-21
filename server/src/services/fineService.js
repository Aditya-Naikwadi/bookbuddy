const Fine = require('../models/Fine');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const calculateFine = async (loan) => {
  // If not overdue, no fine
  if (!loan.returnDate || loan.returnDate <= loan.dueDate) {
    return null;
  }

  // Calculate days overdue
  const diffTime = Math.abs(loan.returnDate - loan.dueDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return null;

  const ratePerDay = 5; // e.g. 5 currency units per day
  const amount = diffDays * ratePerDay;

  const fine = await Fine.create({
    userId: loan.userId,
    loanId: loan._id,
    amount,
    ratePerDay,
    daysOverdue: diffDays,
    status: 'unpaid'
  });

  return fine;
};

const payFine = async (fineId, userId, useWaiver = false) => {
  const fine = await Fine.findOne({ _id: fineId, userId });
  if (!fine) {
    throw new AppError('Fine not found', 404);
  }

  if (fine.status !== 'unpaid') {
    throw new AppError('Fine is already paid or waived', 400);
  }

  const user = await User.findById(userId);

  if (useWaiver) {
    if (user.fineWaiverCoupons > 0) {
      user.fineWaiverCoupons -= 1;
      await user.save();
      fine.status = 'waived';
    } else {
      throw new AppError('No fine waiver coupons available', 400);
    }
  } else {
    // Process real payment here, for now just mark paid
    fine.status = 'paid';
    fine.paymentRef = `PAY-${Date.now()}`;
  }

  fine.paidAt = new Date();
  await fine.save();

  return fine;
};

module.exports = {
  calculateFine,
  payFine
};
