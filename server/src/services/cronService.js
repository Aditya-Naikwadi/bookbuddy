const cron = require('node-cron');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const Reservation = require('../models/Reservation');
const Streak = require('../models/Streak');
const User = require('../models/User');

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

  // 4. Hourly streak expiry sweep
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running hourly streak expiry sweep...');
    const users = await User.find({}).select('_id timezone');
    for (let user of users) {
      const tz = user.timezone || 'Asia/Kolkata';
      // In JS, we can get current hour in local TZ
      const now = new Date();
      const localHourStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: 'numeric' });
      const localHour = parseInt(localHourStr, 10);
      
      // If it's just past midnight (hour 0) in the user's timezone
      if (localHour === 0) {
        // Evaluate if they missed yesterday
        const yesterdayStr = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: tz });
        const streak = await Streak.findOne({ userId: user._id });
        if (streak && streak.currentStreak > 0 && streak.lastQualifyingDate !== yesterdayStr) {
          // If they didn't qualify yesterday
          if (streak.freezesAvailable > 0) {
            streak.freezesAvailable -= 1;
            streak.freezesUsedTotal += 1;
            console.log(`[Cron] Applied freeze for user ${user._id}`);
          } else {
            streak.currentStreak = 0; // completely lost streak
            console.log(`[Cron] Streak lost for user ${user._id}`);
          }
          await streak.save();
        }
      }
    }
  });

  // 5. Daily Streak Reminder Job (runs hourly, checks if ~3 hours to midnight in user's timezone)
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running daily streak reminder job...');
    const users = await User.find({}).select('_id timezone email');
    for (let user of users) {
      const tz = user.timezone || 'Asia/Kolkata';
      const now = new Date();
      const localHourStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: 'numeric' });
      const localHour = parseInt(localHourStr, 10);

      // ~3 hours before midnight is hour 21
      if (localHour === 21) {
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
        const streak = await Streak.findOne({ userId: user._id });
        
        if (streak && streak.currentStreak > 0 && streak.lastQualifyingDate !== todayStr) {
          console.log(`[Cron] REMINDER: User ${user._id} has 3 hours left to keep their ${streak.currentStreak}-day streak alive!`);
          // Note: In real app, dispatch email or push notification here
        }
      }
    }
  });

  // 6. Monthly Repair Flag Reset
  cron.schedule('0 0 1 * *', async () => {
    console.log('[Cron] Resetting streak repair flags for the month...');
    await Streak.updateMany({}, { repairUsedThisMonth: false });
  });
};

module.exports = initCronJobs;
