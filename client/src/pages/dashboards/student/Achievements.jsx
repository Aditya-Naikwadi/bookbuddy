import React from 'react';
import { useStreakData } from '../../../hooks/useStreakData';
import { useCheckIn } from '../../../hooks/useCheckIn';
import { CheckInButton } from '../../../components/student/achievements/CheckInButton';
import { StreakSummary } from '../../../components/student/achievements/StreakSummary';
import { StreakCalendar } from '../../../components/student/achievements/StreakCalendar';
import { BadgeGrid } from '../../../components/student/achievements/BadgeGrid';
import { MilestoneCelebrationModal } from '../../../features/streak/MilestoneCelebrationModal';
import { Loader2, AlertCircle } from 'lucide-react';

const Achievements = () => {
  const { streak, rewards, catalog, earned, isLoading, isError, refetchAll } = useStreakData();
  const { checkIn, isCheckInPending, repairStreak, isRepairPending, announcement } = useCheckIn();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <h2 className="text-slate-600 font-medium tracking-wide">Loading Achievements...</h2>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <AlertCircle className="text-danger mx-auto" size={40} />
        <h2 className="text-lg font-bold text-slate-800">Failed to load streak statistics</h2>
        <p className="text-xs text-slate-500">
          We encountered an issue checking your daily reading streaks. Verify your internet connection and try reloading the page.
        </p>
      </div>
    );
  }

  const { currentStreak = 0, longestStreak = 0, freezesAvailable = 0, todayComplete = false, lastQualifyingDate } = streak || {};

  // Find next milestone details
  const nextMilestone = rewards.find((r) => r.milestoneThreshold > currentStreak);
  const progressPercent = nextMilestone
    ? (currentStreak / nextMilestone.milestoneThreshold) * 100
    : 100;

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4 py-6">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Reading Streaks & achievements</h1>
          <p className="text-xs text-slate-500 mt-1">
            Check in once a day, build reading milestones, and unlock customized sticker awards.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Check-In Controls */}
        <div className="md:col-span-2 space-y-6">
          {/* Daily Check-In widget card */}
          <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
            <h2 className="font-serif font-black text-xl text-slate-900">Extend Your Reading Pass</h2>
            <p className="text-xs text-slate-500 max-w-sm">
              Keep check-in streaks active by logging in once per calendar day.
            </p>
            <CheckInButton
              todayComplete={todayComplete}
              onCheckIn={checkIn}
              isPending={isCheckInPending}
              announcement={announcement}
            />
          </div>

          {/* Streak summary and calendar */}
          <StreakSummary
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            freezesAvailable={freezesAvailable}
            todayComplete={todayComplete}
            onRepairStreak={repairStreak}
            isRepairPending={isRepairPending}
          />
        </div>

        {/* Milestone status and calendar activity log */}
        <div className="space-y-6">
          {/* Milestone progress card */}
          {nextMilestone && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Next Milestone Progress
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>{nextMilestone.milestoneThreshold} Day Streak Badge</span>
                  <span className="text-indigo-600">{nextMilestone.milestoneThreshold - currentStreak} days left</span>
                </div>
                {/* Custom Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-orange-500 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                    role="progressbar"
                    aria-valuenow={currentStreak}
                    aria-valuemin="0"
                    aria-valuemax={nextMilestone.milestoneThreshold}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-normal pt-1">
                  Cross this milestone to earn a {nextMilestone.rewardType} unlock!
                </p>
              </div>
            </div>
          )}

          {/* Calendar weekly check-in row */}
          <StreakCalendar
            currentStreak={currentStreak}
            lastQualifyingDate={lastQualifyingDate}
            todayComplete={todayComplete}
            timezone={streak?.timezone || 'Asia/Kolkata'}
          />
        </div>
      </div>

      {/* Grid containing achieved/locked sticker badges */}
      <BadgeGrid catalog={catalog} earned={earned} />

      {/* Confetti celebration modal overlay */}
      <MilestoneCelebrationModal />
    </div>
  );
};

export default Achievements;
