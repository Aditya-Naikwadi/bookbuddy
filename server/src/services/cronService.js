const cron = require('node-cron');
const CronRunLog = require('../models/CronRunLog');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const Reservation = require('../models/Reservation');
const Streak = require('../models/Streak');
const CheckInLog = require('../models/CheckInLog');
const notificationService = require('./notificationService');
const reservationService = require('./reservationService');
const streakService = require('./streakService');
const timezoneHelper = require('../utils/timezoneHelper');
const config = require('../config');
const logger = require('../utils/logger');
const { emitStreakUpdate } = require('../sockets');
const { runInTransaction } = require('../utils/transactionHelper');

/**
 * Single job runner wrapper for observability and failure isolation.
 */
const runJob = async (jobName, jobFn) => {
  const startedAt = new Date();
  let affectedCount;
  try {
    affectedCount = await jobFn();
    await CronRunLog.create({
      jobName,
      startedAt,
      finishedAt: new Date(),
      status: 'success',
      affectedCount,
    });
  } catch (err) {
    logger.error(`Cron job ${jobName} failed: ${err.message}`, err);
    await CronRunLog.create({
      jobName,
      startedAt,
      finishedAt: new Date(),
      status: 'failed',
      errorMessage: err.message,
    });
  }
};

const { DateTime } = require('luxon');

const getOverdueDays = (dueDate, now, timezone = 'UTC') => {
  const dueDt = DateTime.fromJSDate(dueDate).setZone(timezone).startOf('day');
  const nowDt = DateTime.fromJSDate(now).setZone(timezone).startOf('day');
  const diff = nowDt.diff(dueDt, 'days').days;
  return Math.max(0, Math.floor(diff));
};

/**
 * JOB 1: Overdue Fine Accrual
 * Runs daily at midnight to assess active overdue loans and apply/accumulate fines.
 */
const runOverdueFineAccrual = async () => {
  const now = new Date();
  // Find all active or already overdue loans past their due date
  const loans = await Loan.find({
    status: { $in: ['active', 'overdue'] },
    dueDate: { $lt: now },
  });

  let affected = 0;
  for (const loan of loans) {
    // Transition status to overdue if still marked active
    if (loan.status === 'active') {
      loan.status = 'overdue';
      await loan.save();
    }

    // Calculate overdue metrics timezone-correctly
    const overdueDays = getOverdueDays(loan.dueDate, now, 'UTC');
    if (overdueDays <= 0) {
      continue;
    }

    const amount = Math.min(overdueDays * config.fineRatePerDay, config.fineMaxAmount);

    // Idempotency: find or update existing unpaid fine
    let fine = await Fine.findOne({ loanId: loan._id, status: 'unpaid' });
    if (fine) {
      fine.overdueDays = overdueDays;
      fine.amount = amount;
      await fine.save();
    } else {
      fine = await Fine.create({
        collegeId: loan.collegeId,
        userId: loan.userId,
        loanId: loan._id,
        amount,
        overdueDays,
        status: 'unpaid',
      });
    }

    await notificationService.notify(
      loan.userId,
      'fine_issued',
      `You have an accumulated fine of ${amount} for an overdue book.`,
      fine._id,
      'Fine'
    );
    affected++;
  }
  return affected;
};

/**
 * JOB 2: Queue Expiry Sweep
 * Runs hourly to clear expired pickup holds (pickup window expired).
 */
const runQueueExpirySweep = async () => {
  const cutoff = new Date(Date.now() - config.holdPickupWindowHours * 60 * 60 * 1000);
  const reservations = await Reservation.find({
    status: 'ready_for_pickup',
    readyAt: { $lt: cutoff },
  });

  let affected = 0;
  for (const res of reservations) {
    res.status = 'expired';
    await res.save();

    await notificationService.notify(
      res.userId,
      'general',
      'Your book reservation has expired.',
      res.bookId,
      'Book'
    );

    // Atomically promote next hold from queue using Phase 2 service function
    await reservationService.promoteNextHold(res.bookId, res.collegeId);
    affected++;
  }
  return affected;
};

/**
 * JOB 3: Due Reminders
 * Runs daily at 9am to alert users of upcoming return deadlines.
 */
const runDueReminders = async () => {
  const now = new Date();
  const daysOut = config.dueReminderDaysBefore;

  // Compute exact day range N days out to send exactly one reminder
  const targetDateStart = new Date();
  targetDateStart.setDate(now.getDate() + daysOut);
  targetDateStart.setHours(0, 0, 0, 0);

  const targetDateEnd = new Date();
  targetDateEnd.setDate(now.getDate() + daysOut);
  targetDateEnd.setHours(23, 59, 59, 999);

  const loans = await Loan.find({
    status: 'active',
    dueDate: { $gte: targetDateStart, $lte: targetDateEnd },
  });

  let affected = 0;
  for (const loan of loans) {
    await notificationService.notify(
      loan.userId,
      'general',
      `Your loan is due in ${daysOut} days on ${loan.dueDate.toLocaleDateString()}.`,
      loan.bookId,
      'Book'
    );
    affected++;
  }
  return affected;
};

/**
 * JOB 4: Streak Expiry Sweep
 * Runs hourly. Reset user streaks at their respective local midnights.
 */
const runStreakExpirySweep = async (mockNow = null) => {
  const referenceTime = mockNow || new Date();
  const streaks = await Streak.find({});

  let affected = 0;
  for (const streak of streaks) {
    const timezone = streak.timezone || 'Asia/Kolkata';

    // Verify if it is currently midnight for this user
    if (!timezoneHelper.isMidnight(referenceTime, timezone)) {
      continue;
    }

    const todayStr = streakService.getLocalDateString(referenceTime, timezone);

    const yesterday = new Date(referenceTime.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = streakService.getLocalDateString(yesterday, timezone);

    const lastActionStr = streak.lastQualifyingActionAt
      ? streakService.getLocalDateString(streak.lastQualifyingActionAt, timezone)
      : null;

    // Check if they did NOT perform any qualifying actions yesterday or today
    if (lastActionStr !== todayStr && lastActionStr !== yesterdayStr) {
      await runInTransaction(async (session) => {
        const trStreak = await Streak.findById(streak._id).session(session);
        if (!trStreak) return;

        // Double check: does a log exist for yesterday already?
        const existingYesterdayLog = await CheckInLog.findOne({
          userId: trStreak.userId,
          checkInDate: yesterdayStr,
        }).session(session);

        if (!existingYesterdayLog) {
          if (trStreak.freezesAvailable > 0) {
            trStreak.freezesAvailable -= 1;
            await CheckInLog.create(
              [
                {
                  collegeId: trStreak.collegeId,
                  userId: trStreak.userId,
                  checkInDate: yesterdayStr,
                  timestamp: referenceTime,
                  freezeConsumed: true,
                },
              ],
              { session }
            );
          } else {
            trStreak.currentStreak = 0;
          }
          await trStreak.save({ session });
          emitStreakUpdate(trStreak.userId, trStreak);
          affected++;
        }
      });
    }
  }
  return affected;
};

/**
 * JOB 5: Streak Reminders
 * Runs hourly. Notifies users with active streaks 3 hours before their local midnight.
 */
const runStreakReminders = async (mockNow = null) => {
  const referenceTime = mockNow || new Date();
  const streaks = await Streak.find({ currentStreak: { $gt: 0 } });

  let affected = 0;
  for (const streak of streaks) {
    const timezone = streak.timezone || 'Asia/Kolkata';

    // Check if the user is 3 hours from local midnight
    if (
      !timezoneHelper.isHoursBeforeMidnight(
        referenceTime,
        timezone,
        config.streakReminderHoursBefore
      )
    ) {
      continue;
    }

    const todayStr = streakService.getLocalDateString(referenceTime, timezone);

    const lastActionStr = streak.lastQualifyingActionAt
      ? streakService.getLocalDateString(streak.lastQualifyingActionAt, timezone)
      : null;

    // Skip if they already checked in today
    if (lastActionStr === todayStr) {
      continue;
    }

    // Idempotency: skip if they were already reminded today
    const lastReminderStr = streak.lastStreakReminderSentAt
      ? streakService.getLocalDateString(streak.lastStreakReminderSentAt, timezone)
      : null;
    if (lastReminderStr === todayStr) {
      continue;
    }

    // Send warning notification
    await notificationService.notify(
      streak.userId,
      'streak_at_risk',
      `Your ${streak.currentStreak}-day streak is at risk! Perform a qualifying action in the next 3 hours to protect it.`
    );

    streak.lastStreakReminderSentAt = referenceTime;
    await streak.save();
    affected++;
  }
  return affected;
};

/**
 * Schedules all background cron jobs with node-cron.
 */
const initCronJobs = () => {
  // Overdue Fine Accrual: Daily at midnight
  cron.schedule('0 0 * * *', () => {
    runJob('Overdue Fine Accrual', runOverdueFineAccrual);
  });

  // Queue Expiry Sweep: Hourly
  cron.schedule('0 * * * *', () => {
    runJob('Queue Expiry Sweep', runQueueExpirySweep);
  });

  // Due Reminders: Daily at 9 AM
  cron.schedule('0 9 * * *', () => {
    runJob('Due Reminders', runDueReminders);
  });

  // Streak Expiry Sweep: Hourly
  cron.schedule('0 * * * *', () => {
    runJob('Streak Expiry Sweep', () => runStreakExpirySweep());
  });

  // Streak Reminders: Hourly
  cron.schedule('0 * * * *', () => {
    runJob('Streak Reminders', () => runStreakReminders());
  });

  logger.info('Cron jobs initialized successfully.');
};

module.exports = {
  initCronJobs,
  runJob,
  runOverdueFineAccrual,
  runQueueExpirySweep,
  runDueReminders,
  runStreakExpirySweep,
  runStreakReminders,
};
