import { Trash2, ExternalLink, BookOpen, FileText } from "lucide-react";

const statusBadges = {
  Available: "bg-emerald-950/80 text-emerald-300 border-emerald-800/80",
  "Open Access": "bg-emerald-950/80 text-emerald-300 border-emerald-800/80",
  "On Hold": "bg-amber-950/80 text-amber-300 border-amber-800/80",
  "Checked Out": "bg-rose-950/80 text-rose-300 border-rose-800/80",
};

const BookmarkCard = ({ item, onRemove, onAction }) => {
  if (!item) return null;

  const isEresource =
    item.type === "EResource" || item.gutenbergId || item.accessRequirement;
  const TypeIcon = isEresource ? FileText : BookOpen;
  const status =
    item.availabilityStatus ||
    item.status ||
    (isEresource ? "Open Access" : "Available");
  const badgeClass = statusBadges[status] || statusBadges.Available;

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl hover:border-indigo-500/50 hover:shadow-2xl transition-all duration-200 p-5 flex flex-col justify-between group relative">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 rounded-xl">
            <TypeIcon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {isEresource ? "E-Resource" : "Book"}
          </span>
        </div>

        <button
          onClick={() => onRemove(item.id || item._id)}
          title="Remove bookmark"
          className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 p-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-800/60"
          aria-label="Remove bookmark"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badgeClass}`}
          >
            {status}
          </span>
          {item.savedAt && (
            <span className="text-[10px] text-slate-400">
              Saved {new Date(item.savedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <h3 className="font-bold text-slate-100 text-sm leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors mb-1">
          {item.title}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-1">
          {item.author || item.topic || "Library Asset"}
        </p>
      </div>

      <div className="pt-3 border-t border-slate-800/80 mt-auto">
        <button
          onClick={() => onAction && onAction(item)}
          className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
        >
          <span>{isEresource ? "Read Resource" : "View Catalog Entry"}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default BookmarkCard;
