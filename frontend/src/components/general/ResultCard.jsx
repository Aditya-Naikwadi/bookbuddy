import { motion } from "framer-motion";
import {
  Bookmark,
  MapPin,
  BookOpen,
  CheckCircle2,
  Clock,
  XCircle,
  Quote,
} from "lucide-react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

const availabilityConfig = {
  Available: {
    badge:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20 dark:border-emerald-800/80",
    icon: CheckCircle2,
    label: "Available",
  },
  "On Hold": {
    badge:
      "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20 dark:border-amber-800/80",
    icon: Clock,
    label: "On Hold",
  },
  "Checked Out": {
    badge:
      "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20 dark:border-rose-800/80",
    icon: XCircle,
    label: "Checked Out",
  },
};

const ResultCard = ({
  book,
  onToggleBookmark,
  isBookmarked = false,
  onViewLocation,
  onReadOnline,
  onCite,
  loading = false,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (loading) {
    return (
      <div className="bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-edge shadow-sm overflow-hidden animate-pulse flex flex-col h-full">
        <div className="h-44 bg-slate-100 dark:bg-slate-800 w-full"></div>
        <div className="p-4 flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
          <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
          <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-md mt-4"></div>
        </div>
      </div>
    );
  }

  if (!book) return null;

  const statusKey =
    book.availabilityStatus ||
    (book.availableCopies > 0 ? "Available" : "Checked Out");
  const status = availabilityConfig[statusKey] || availabilityConfig.Available;
  const StatusIcon = status.icon;
  const digitalFileUrl =
    book.fileUrl || book.downloadUrl || book.pdfUrl || book.epubUrl;

  return (
    <motion.div
      whileHover={prefersReducedMotion ? {} : { y: -4 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-edge shadow-md hover:shadow-xl hover:border-indigo-500/50 transition-all duration-200 overflow-hidden flex flex-col group relative"
    >
      {/* Cover / Graphic */}
      <div className="h-48 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 w-full relative flex items-center justify-center p-4 text-center overflow-hidden border-b border-slate-200/80 dark:border-slate-800/80">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-300 space-y-2">
            <BookOpen className="w-10 h-10 text-indigo-400 mb-1" />
            <span className="text-xs font-semibold px-3 text-slate-100 line-clamp-2">
              {book.title}
            </span>
          </div>
        )}

        {/* Category Badge */}
        {book.genre && (
          <span className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg">
            {book.genre}
          </span>
        )}

        {/* Bookmark Action Button */}
        {onToggleBookmark && (
          <button
            onClick={() => onToggleBookmark(book)}
            title={isBookmarked ? "Remove bookmark" : "Save bookmark"}
            className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all duration-200 shadow-sm ${
              isBookmarked
                ? "bg-amber-500 text-white shadow-amber-500/30 scale-105"
                : "bg-slate-950/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
            }`}
            aria-label="Toggle bookmark"
          >
            <Bookmark
              className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${status.badge}`}
            >
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            {book.year && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {book.year}
              </span>
            )}
          </div>

          <h3 className="font-bold text-slate-900 dark:text-ink text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
            {book.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-muted line-clamp-1 mb-3">
            By {book.author || "Unknown Author"}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 mt-auto">
          {digitalFileUrl && (
            <button
              onClick={() =>
                onReadOnline &&
                onReadOnline({ ...book, fileUrl: digitalFileUrl })
              }
              className="flex-1 text-xs font-bold py-2 px-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Read Online</span>
            </button>
          )}

          <button
            onClick={() => onViewLocation && onViewLocation(book)}
            className={`${digitalFileUrl ? "w-auto" : "w-full"} text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all flex items-center justify-center gap-1.5`}
          >
            <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:text-white" />
            <span>{digitalFileUrl ? "Locate" : "Locate Shelf"}</span>
          </button>

          {onCite && (
            <button
              onClick={() => onCite(book)}
              title="Cite this item"
              className="p-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500 transition-all"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ResultCard;
