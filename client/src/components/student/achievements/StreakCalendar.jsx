import { Check, Flame, AlertCircle } from "lucide-react";

export const StreakCalendar = ({
  currentStreak = 0,
  lastQualifyingDate,
  todayComplete = false,
  timezone = "Asia/Kolkata",
}) => {
  // Generate the last 7 calendar days ending today
  const days = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: timezone });
    const dayName = d.toLocaleDateString(undefined, { weekday: "short" });
    const dayNumber = d.getDate();

    days.push({
      dateStr,
      dayName,
      dayNumber,
      isToday: i === 0,
    });
  }

  // Deduce check-in status from currentStreak & lastQualifyingDate
  // If todayComplete is true: today and the previous (currentStreak - 1) days are checked in.
  // If todayComplete is false: today is pending, yesterday and previous (currentStreak - 1) days are checked in.
  const getDayStatus = (dateStr, isToday) => {
    if (isToday && !todayComplete) {
      return "pending"; // Pending check-in today
    }

    if (!lastQualifyingDate) {
      return "missed";
    }

    const lastDate = new Date(lastQualifyingDate);
    const checkDate = new Date(dateStr);

    const diffTime = lastDate - checkDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays < currentStreak) {
      return "checked"; // Within the active streak window
    }

    return "missed";
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <AlertCircle className="text-orange-500 w-4 h-4" />
          Recent Activity (Last 7 Days)
        </h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Weekly Log
        </span>
      </div>

      {/* Grid of days */}
      <div className="grid grid-cols-7 gap-2 sm:gap-4 select-none">
        {days.map((day) => {
          const status = getDayStatus(day.dateStr, day.isToday);

          let statusText;
          let statusClasses;
          let icon = null;

          if (status === "checked") {
            statusText = "Checked in";
            statusClasses =
              "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/25";
            icon = <Check size={14} strokeWidth={3} />;
          } else if (status === "pending") {
            statusText = "Pending Check-in";
            statusClasses =
              "border-2 border-dashed border-orange-500 text-orange-500 animate-pulse";
            icon = <Flame size={14} fill="currentColor" />;
          } else {
            statusText = "Missed check-in";
            statusClasses = "bg-slate-100 text-slate-400 border-slate-200";
          }

          return (
            <div
              key={day.dateStr}
              className="flex flex-col items-center gap-1.5 focus:outline-none"
              tabIndex={0}
              aria-label={`${day.isToday ? "Today, " : ""}${day.dayName} ${day.dayNumber}: ${statusText}`}
            >
              {/* Day bubble */}
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center text-xs font-black transition-all ${statusClasses}`}
              >
                {icon ? icon : day.dayNumber}
              </div>

              {/* Day label */}
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wide ${day.isToday ? "text-indigo font-black" : "text-slate-400"}`}
              >
                {day.dayName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StreakCalendar;
