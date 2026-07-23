import { Trash2, ExternalLink, BookOpen, FileText } from 'lucide-react';

const statusBadges = {
  Available: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  'Open Access': 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  'On Hold': 'bg-amber-50 text-amber-700 border-amber-200/80',
  'Checked Out': 'bg-rose-50 text-rose-700 border-rose-200/80',
};

const BookmarkCard = ({ item, onRemove, onAction }) => {
  if (!item) return null;

  const isEresource = item.type === 'EResource' || item.gutenbergId || item.accessRequirement;
  const TypeIcon = isEresource ? FileText : BookOpen;
  const status = item.availabilityStatus || item.status || (isEresource ? 'Open Access' : 'Available');
  const badgeClass = statusBadges[status] || statusBadges.Available;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group relative">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <TypeIcon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {isEresource ? 'E-Resource' : 'Book'}
          </span>
        </div>

        <button
          onClick={() => onRemove(item.id || item._id)}
          title="Remove bookmark"
          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
          aria-label="Remove bookmark"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badgeClass}`}>
            {status}
          </span>
          {item.savedAt && (
            <span className="text-[10px] text-slate-400">
              Saved {new Date(item.savedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors mb-1">
          {item.title}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-1">{item.author || item.topic || 'Library Asset'}</p>
      </div>

      <div className="pt-3 border-t border-slate-100 mt-auto">
        <button
          onClick={() => onAction && onAction(item)}
          className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-1.5"
        >
          <span>{isEresource ? 'Read Resource' : 'View Catalog Entry'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default BookmarkCard;
