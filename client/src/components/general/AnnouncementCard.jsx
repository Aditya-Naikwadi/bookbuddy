import { AlertTriangle, AlertOctagon, Info, X } from "lucide-react";

const priorityConfig = {
  Urgent: {
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    cardBorder: "border-l-4 border-l-rose-500 border-slate-200/80",
    iconBg: "bg-rose-50 text-rose-600",
    icon: AlertOctagon,
  },
  Warning: {
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    cardBorder: "border-l-4 border-l-amber-500 border-slate-200/80",
    iconBg: "bg-amber-50 text-amber-600",
    icon: AlertTriangle,
  },
  Notice: {
    badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
    cardBorder: "border-l-4 border-l-indigo-500 border-slate-200/80",
    iconBg: "bg-indigo-50 text-indigo-600",
    icon: Info,
  },
};

const AnnouncementCard = ({ announcement, onDismiss, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm animate-pulse flex items-start gap-4">
        <div className="w-10 h-10 bg-slate-200 rounded-xl flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 bg-slate-200 rounded-md"></div>
          <div className="h-3 w-3/4 bg-slate-200 rounded-md"></div>
          <div className="h-3 w-1/4 bg-slate-200 rounded-md"></div>
        </div>
      </div>
    );
  }

  if (!announcement) return null;

  const priority = announcement.priority || "Notice";
  const config = priorityConfig[priority] || priorityConfig.Notice;
  const PriorityIcon = config.icon;

  return (
    <div
      className={`bg-white p-5 rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md flex items-start gap-4 relative group ${config.cardBorder}`}
    >
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${config.iconBg}`}>
        <PriorityIcon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border ${config.badge}`}
          >
            {priority}
          </span>
          {announcement.timestamp && (
            <span className="text-xs text-slate-400 font-medium">
              {announcement.timestamp}
            </span>
          )}
        </div>

        <h4 className="text-sm font-bold text-slate-900 mb-1 leading-snug">
          {announcement.title}
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          {announcement.content}
        </p>
      </div>

      {onDismiss && (
        <button
          onClick={() => onDismiss(announcement.id || announcement._id)}
          title="Dismiss notice"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default AnnouncementCard;
