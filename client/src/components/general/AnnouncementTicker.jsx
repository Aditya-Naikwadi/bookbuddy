import { AlertCircle, Info, Bell } from 'lucide-react';

const priorityConfig = {
  Urgent: { bg: 'bg-rose-50 border-rose-200 text-rose-800', badge: 'bg-rose-600 text-white', icon: AlertCircle },
  Warning: { bg: 'bg-amber-50 border-amber-200 text-amber-800', badge: 'bg-amber-500 text-white', icon: Bell },
  Notice: { bg: 'bg-indigo-50 border-indigo-200 text-indigo-800', badge: 'bg-indigo-600 text-white', icon: Info },
};

const AnnouncementTicker = ({ announcements = [], onDismiss }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (announcements.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [announcements.length, isPaused]);

  if (!announcements || announcements.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2.5 px-4 bg-emerald-50/80 border border-emerald-200/80 text-emerald-800 rounded-xl text-xs font-medium">
        <Info className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>All systems normal. No active campus operational announcements at this time.</span>
      </div>
    );
  }

  const current = announcements[currentIndex] || announcements[0];
  const config = priorityConfig[current.priority] || priorityConfig.Notice;
  const PriorityIcon = config.icon;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`flex items-center justify-between gap-3 p-2.5 px-4 rounded-xl border text-xs font-medium transition-all shadow-sm ${config.bg}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
          {current.priority}
        </span>

        <PriorityIcon className="w-4 h-4 flex-shrink-0" />

        <div className="truncate flex items-center gap-2">
          <span className="font-bold text-slate-900 truncate">{current.title}:</span>
          <span className="text-slate-700 truncate">{current.content}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[10px] text-slate-400 font-semibold px-1">
          {currentIndex + 1}/{announcements.length}
        </span>

        <button
          onClick={() => setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length)}
          className="p-1 rounded-md hover:bg-black/5 text-slate-600 transition-colors"
          title="Previous Notice"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setCurrentIndex((prev) => (prev + 1) % announcements.length)}
          className="p-1 rounded-md hover:bg-black/5 text-slate-600 transition-colors"
          title="Next Notice"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {onDismiss && (
          <button
            onClick={() => onDismiss(current.id)}
            className="p-1 rounded-md hover:bg-black/10 text-slate-500 hover:text-slate-800 transition-colors ml-1"
            title="Dismiss Notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AnnouncementTicker;
