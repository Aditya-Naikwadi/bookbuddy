const Fine = require('../models/Fine');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const notificationService = require('./notificationService');
const { runInTransaction } = require('../utils/transactionHelper');

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
    collegeId: loan.collegeId,
    userId: loan.userId,
    loanId: loan._id,
    amount,
    ratePerDay,
    daysOverdue: diffDays,
    overdueDays: diffDays,
    status: 'unpaid',
  });

  await notificationService.notify(
    loan.userId,
    'fine_issued',
    `You have been issued a fine of ${amount} for an overdue book.`,
    fine._id,
    'Fine'
  );

  return fine;
};

const payFine = async (fineId, userId, collegeId, useWaiver = false) => {
  return await runInTransaction(async (session) => {
    const fine = await Fine.findOne({ _id: fineId, userId, collegeId }).session(session);
    if (!fine) {
      throw new AppError('Fine not found or unauthorized access.', 404);
    }

    if (fine.status !== 'unpaid') {
      throw new AppError('Fine is already paid or waived.', 400);
    }

    const user = await User.findById(userId).session(session);

    if (useWaiver) {
      if (user.fineWaiverCoupons > 0) {
        user.fineWaiverCoupons -= 1;
        await user.save({ session });
        fine.status = 'waived';
      } else {
        throw new AppError('No fine waiver coupons available.', 400);
      }
    } else {
      // Process mock payment integration, marking as paid
      fine.status = 'paid';
    }

    fine.paidAt = new Date();
    await fine.save({ session });

    return fine;
  });
};

const payAllFines = async (userId, collegeId) => {
  return await runInTransaction(async (session) => {
    const fines = await Fine.find({ userId, collegeId, status: 'unpaid' }).session(session);
    if (fines.length === 0) {
      throw new AppError('No unpaid fines found to process.', 400);
    }

    const totalAmount = fines.reduce((sum, f) => sum + f.amount, 0);

    await Fine.updateMany(
      { userId, collegeId, status: 'unpaid' },
      { $set: { status: 'paid', paidAt: new Date() } }
    ).session(session);

    return {
      fineIds: fines.map((f) => f._id),
      amount: totalAmount,
      status: 'paid',
    };
  });
};

module.exports = {
  calculateFine,
  payFine,
  payAllFines,
};
