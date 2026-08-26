import { AlertCircle, RefreshCw, BookOpen } from "lucide-react";

/**
 * Shared container component for handling Book Data states:
 * - Real Skeleton loader (when isLoading)
 * - Explicit Error banner with retry option (when isError)
 * - Custom or default Empty State (when empty)
 * - Content rendering (when data arrives)
 */
export const BookDataState = ({
  isLoading = false,
  isError = false,
  error = null,
  isEmpty = false,
  collegeName = null,
  onRetry = null,
  onClearFilter = null,
  skeleton = null,
  emptyState = null,
  children,
}) => {
  // 1. Loading State: Render custom skeleton or default dark-mode compatible skeleton cards
  if (isLoading) {
    if (skeleton) return <>{skeleton}</>;
    return (
      <div className="w-full space-y-3 animate-pulse p-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3 mb-2"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State: Render dark-mode compatible clear error banner with retry button
  if (isError) {
    return (
      <div className="w-full bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 sm:p-5 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-xl text-rose-600 dark:text-rose-300 flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-rose-900 dark:text-rose-100">
              Unable to load book catalog data
            </h4>
            <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
              {error?.message ||
                "A network error occurred while fetching books. Please try again."}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs flex-shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Dark-theme compatible Empty State
  if (isEmpty) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <div className="w-full bg-slate-50 dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-6 text-center space-y-3 my-2">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-ink">
            No books found
          </h4>
          <p className="text-xs text-slate-500 dark:text-muted max-w-sm mx-auto mt-1">
            {collegeName
              ? `No catalog items currently match ${collegeName}.`
              : "There are currently no catalog items matching this view or campus selection."}
          </p>
        </div>

        {(onClearFilter || onRetry) && (
          <div className="pt-1 flex items-center justify-center gap-2">
            {onClearFilter && (
              <button
                onClick={onClearFilter}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Refresh Data
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 4. Content State
  return <>{children}</>;
};

export default BookDataState;
