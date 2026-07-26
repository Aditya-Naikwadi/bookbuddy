import React from "react";

const VirtualizedCardGrid = ({
  items = [],
  renderItem,
  loading = false,
  emptyState,
  viewMode = "grid",
  columns = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
}) => {
  if (loading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div
          className={`grid ${viewMode === "list" ? "grid-cols-1" : columns} gap-4`}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm animate-pulse space-y-3"
            >
              <div className="flex justify-between">
                <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
                <div className="w-20 h-4 bg-slate-200 rounded-md"></div>
              </div>
              <div className="h-4 w-3/4 bg-slate-200 rounded-md"></div>
              <div className="h-3 w-1/2 bg-slate-200 rounded-md"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 scrollbar-thin">
      <div
        className={`grid ${viewMode === "list" ? "grid-cols-1" : columns} gap-4 pb-4`}
      >
        {items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  );
};

export default VirtualizedCardGrid;
