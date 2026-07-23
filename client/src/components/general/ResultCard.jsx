import { Bookmark, MapPin, BookOpen, CheckCircle2, Clock, XCircle } from 'lucide-react';

const availabilityConfig = {
  Available: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    icon: CheckCircle2,
    label: 'Available',
  },
  'On Hold': {
    badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
    icon: Clock,
    label: 'On Hold',
  },
  'Checked Out': {
    badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
    icon: XCircle,
    label: 'Checked Out',
  },
};

const ResultCard = ({
  book,
  onToggleBookmark,
  isBookmarked = false,
  onViewLocation,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-pulse flex flex-col h-full">
        <div className="h-44 bg-slate-200 w-full"></div>
        <div className="p-4 flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-slate-200 rounded-md"></div>
          <div className="h-3 w-1/2 bg-slate-200 rounded-md"></div>
          <div className="h-3 w-1/3 bg-slate-200 rounded-md mt-4"></div>
        </div>
      </div>
    );
  }

  if (!book) return null;

  const statusKey = book.availabilityStatus || (book.availableCopies > 0 ? 'Available' : 'Checked Out');
  const status = availabilityConfig[statusKey] || availabilityConfig.Available;
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group relative">
      {/* Cover / Placeholder Graphic */}
      <div className="h-48 bg-gradient-to-br from-indigo-900 via-slate-800 to-slate-900 w-full relative flex items-center justify-center p-4 text-center overflow-hidden">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-300 space-y-2">
            <BookOpen className="w-10 h-10 text-indigo-400/80 mb-1" />
            <span className="text-xs font-semibold px-3 text-slate-200 line-clamp-2">{book.title}</span>
          </div>
        )}

        {/* Format Badge */}
        {book.genre && (
          <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-slate-200 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-white/10">
            {book.genre}
          </span>
        )}

        {/* Bookmark Action Button */}
        {onToggleBookmark && (
          <button
            onClick={() => onToggleBookmark(book)}
            title={isBookmarked ? 'Remove bookmark' : 'Save bookmark'}
            className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all duration-200 shadow-sm ${
              isBookmarked
                ? 'bg-amber-500 text-white shadow-amber-500/30 scale-105'
                : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900/90 hover:text-white'
            }`}
            aria-label="Toggle bookmark"
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${status.badge}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            {book.year && <span className="text-[11px] font-medium text-slate-400">{book.year}</span>}
          </div>

          <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors mb-1">
            {book.title}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-1 mb-3">By {book.author || 'Unknown Author'}</p>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
          {book.location && (
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 line-clamp-1">
              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
              {book.location}
            </span>
          )}

          <button
            onClick={() => onViewLocation && onViewLocation(book)}
            className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200/80 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all flex items-center justify-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Locate Shelf</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
