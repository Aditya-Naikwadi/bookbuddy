import React from "react";
import { Search, X, LayoutGrid, List, SlidersHorizontal } from "lucide-react";

const StickyControlBar = ({
  searchQuery = "",
  onSearchChange,
  onClearSearch,
  placeholder = "Search...",
  filterSlot,
  sortBy,
  onSortChange,
  sortOptions = [],
  viewMode = "grid",
  onViewModeChange,
  onOpenMobileFilters,
  resultCount = 0,
}) => {
  return (
    <div className="bg-white p-3 px-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-2.5 flex-shrink-0">
      {/* Top Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Search Input Box */}
        <div className="relative flex-1 items-center flex">
          <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Controls & Dropdowns */}
        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
          {/* Mobile Filter Button */}
          {onOpenMobileFilters && (
            <button
              onClick={onOpenMobileFilters}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
          )}

          {/* Sort Selector */}
          {sortOptions.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* View Mode Toggle */}
          {onViewModeChange && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
              <button
                onClick={() => onViewModeChange("grid")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-white text-indigo-600 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onViewModeChange("list")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "list"
                    ? "bg-white text-indigo-600 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Slot / Category Tabs Row */}
      {filterSlot && <div className="pt-0.5">{filterSlot}</div>}

      {/* ARIA Live Region for Result Count Announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {resultCount} items matching search criteria
      </div>
    </div>
  );
};

export default StickyControlBar;
