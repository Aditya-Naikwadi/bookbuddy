import { Flame, Snowflake, Trophy, RotateCcw } from 'lucide-react';
import { Button } from '../../ui/Button';

export const StreakSummary = ({
  currentStreak = 0,
  longestStreak = 0,
  freezesAvailable = 0,
  todayComplete = false,
  onRepairStreak,
  isRepairPending = false,
}) => {
  const isAtRisk = !todayComplete && currentStreak > 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      {/* Current Streak & Longest Streak */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-500 shrink-0 shadow-inner">
          <Flame size={40} className="animate-pulse" fill="currentColor" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Active Streak</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-serif font-black text-slate-900">
              {currentStreak} Days
            </span>
            {isAtRisk && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                At Risk
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <Trophy size={14} className="text-yellow-500" />
            <span>Longest Streak: {longestStreak} days</span>
          </p>
        </div>
      </div>

      <hr className="w-full md:w-px md:h-12 border-slate-100 self-stretch my-1" />

      {/* Freezes Available */}
      <div className="space-y-3 w-full md:w-auto">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-0.5">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Streak Freezes</p>
            <div className="flex gap-1.5 mt-1" role="img" aria-label={`${freezesAvailable} streak freezes available`}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Snowflake
                  key={i}
                  className={`w-5 h-5 transition-all ${
                    i < freezesAvailable
                      ? 'text-indigo animate-bounce-slow'
                      : 'text-slate-200'
                  }`}
                  fill={i < freezesAvailable ? 'currentColor' : 'none'}
                />
              ))}
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 font-mono bg-slate-50 border border-slate-100 rounded-xl px-3 py-1">
            {freezesAvailable}
          </span>
        </div>

        {/* Informative description */}
        <p className="text-[10px] text-slate-500 max-w-xs leading-normal font-medium">
          A **Streak Freeze** is a safety net. It automatically preserves your streak count if you miss a check-in day. 
        </p>

        {/* Repair button if streak is broken (e.g. currentStreak is 0 but they have freezes) */}
        {currentStreak === 0 && freezesAvailable > 0 && (
          <Button
            onClick={onRepairStreak}
            disabled={isRepairPending}
            variant="ghost"
            className="w-full sm:w-auto h-9 text-xs font-bold text-indigo hover:bg-indigo-50 border border-indigo-200/50 flex items-center gap-1.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          >
            <RotateCcw size={13} />
            {isRepairPending ? 'Repairing...' : 'Repair Streak (Use 1 Freeze)'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default StreakSummary;
