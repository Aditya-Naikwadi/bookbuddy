import React from 'react';
import { AlertCircle, RefreshCw, BookOpen } from 'lucide-react';

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
  onRetry = null,
  skeleton = null,
  emptyState = null,
  children,
}) => {
  // 1. Loading State: Render custom skeleton or default skeleton cards
  if (isLoading) {
    if (skeleton) return <>{skeleton}</>;
    return (
      <div className="w-full space-y-3 animate-pulse p-4 bg-slate-50/50 rounded-2xl border border-slate-200/60">
        <div className="h-6 bg-slate-200 rounded-lg w-1/3 mb-2"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-200/80 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State: Render clear error banner with retry button
  if (isError) {
    return (
      <div className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 text-rose-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-xl text-rose-600 flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-rose-900">Unable to load book catalog data</h4>
            <p className="text-[11px] text-rose-700 mt-0.5">
              {error?.message || 'A network error occurred while fetching books. Please try again.'}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Empty State
  if (isEmpty) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-8 text-center space-y-2 my-2">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center">
          <BookOpen className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-900">No books found</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          There are currently no catalog items matching this view or college.
        </p>
      </div>
    );
  }

  // 4. Content State
  return <>{children}</>;
};

export default BookDataState;
