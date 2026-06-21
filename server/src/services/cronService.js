const cron = require('node-cron');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const Reservation = require('../models/Reservation');

const initCronJobs = () => {
  // 1. Overdue fine accrual job - Runs daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running overdue fine accrual job...');
    const now = new Date();
    
    // Find all active loans that are past due
    const overdueLoans = await Loan.find({
      status: 'active',
      dueDate: { $lt: now }
    });

    for (let loan of overdueLoans) {
      // Add Rs. 5 per day fine (mocked for demo)
      console.log(`[Cron] Accruing fine for loan ${loan._id}`);
      // In a real app, calculate exact days and update Fine model
    }
  });

  // 2. Queue expiry sweep - Runs hourly
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running queue expiry sweep...');
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
    
    const expiredReservations = await Reservation.find({
      status: 'ready_for_pickup',
      updatedAt: { $lt: expiryThreshold }
    });

    for (let res of expiredReservations) {
      res.status = 'cancelled';
      await res.save();
      console.log(`[Cron] Expired reservation ${res._id} marked as cancelled.`);
    }
  });

  // 3. Dues reminder job - Runs daily at 9am
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Running dues reminder job...');
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);

    const upcomingLoans = await Loan.find({
      status: 'active',
      dueDate: { 
        $gte: new Date().setHours(0,0,0,0), 
        $lte: inTwoDays 
      }
    });

    console.log(`[Cron] Found ${upcomingLoans.length} loans due soon.`);
  });
};

module.exports = initCronJobs;
