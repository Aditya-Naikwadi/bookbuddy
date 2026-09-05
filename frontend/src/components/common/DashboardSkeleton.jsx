export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="w-full bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-edge p-4 shadow-sm animate-pulse space-y-3">
    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-edge">
      <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
      <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4 items-center py-2">
        {Array.from({ length: cols }).map((_, c) => (
          <div
            key={c}
            className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md flex-1"
            style={{ width: c === 0 ? "35%" : "20%" }}
          />
        ))}
      </div>
    ))}
  </div>
);

export const CardGridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge shadow-sm animate-pulse space-y-3"
      >
        <div className="h-32 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="flex justify-between pt-2">
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

export const DashboardPageSkeleton = () => (
  <div className="flex flex-col min-h-full max-w-7xl mx-auto p-4 gap-5 animate-pulse">
    {/* Header Skeleton */}
    <div className="h-16 bg-white dark:bg-surface rounded-2xl border border-slate-200 dark:border-edge p-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="space-y-1.5">
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3 w-64 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>
      </div>
      <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
    </div>

    {/* Stat Cards Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge shadow-sm space-y-2"
        >
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>
      ))}
    </div>

    {/* Main Content Area Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
      <div className="md:col-span-4 bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge h-72 shadow-sm space-y-3">
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-44 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="md:col-span-8 bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge h-72 shadow-sm space-y-3">
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-44 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  </div>
);

export default DashboardPageSkeleton;
