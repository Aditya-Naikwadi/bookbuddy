import { Flame, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../../ui/Button';

export const CheckInButton = ({
  todayComplete,
  onCheckIn,
  isPending,
  announcement,
}) => {
  return (
    <div className="flex flex-col items-center space-y-3 w-full max-w-sm">
      {/* Screen Reader Announcements */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcement}
      </div>

      <Button
        onClick={() => {
          if (!todayComplete && !isPending) {
            onCheckIn();
          }
        }}
        disabled={todayComplete || isPending}
        className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all text-sm focus:ring-2 focus:ring-orange-500/50 ${
          todayComplete
            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/10 cursor-default opacity-100'
            : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-orange-500/25 active:scale-[0.98]'
        }`}
        aria-pressed={todayComplete}
        aria-label={
          todayComplete
            ? "Checked in for today. Your reading streak is active."
            : "Check in now to extend your daily reading streak."
        }
      >
        {isPending ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            <span>Validating Check-in...</span>
          </>
        ) : todayComplete ? (
          <>
            <CheckCircle size={20} className="text-emerald-500" />
            <span>Checked in today ✓</span>
          </>
        ) : (
          <>
            <Flame size={20} className="animate-pulse" fill="currentColor" />
            <span>Check in now</span>
          </>
        )}
      </Button>

      {/* Encouraging, non-manipulative description */}
      <p className="text-[10px] text-slate-500 text-center font-medium leading-relaxed">
        {todayComplete
          ? "Excellent! You've verified your participation for today. Return tomorrow to continue."
          : "Keep building your check-in momentum. Tap to claim today's streak marker."}
      </p>
    </div>
  );
};

export default CheckInButton;
