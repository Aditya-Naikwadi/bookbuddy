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
  _resultCount = 0,
}) => {
  return (
    <div className="bg-slate-900 p-3 px-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col gap-2.5 flex-shrink-0">
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
            className="w-full pl-9 pr-9 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-200 rounded-md transition-colors"
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
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 text-indigo-300 font-bold text-xs rounded-xl border border-indigo-800/80 hover:bg-indigo-900 transition-all"
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
              className="bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-slate-900 text-slate-100"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* View Mode Toggle */}
          {onViewModeChange && (
            <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
              <button
                onClick={() => onViewModeChange("grid")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "grid"
                    ? "bg-indigo-600 text-white shadow-xs font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onViewModeChange("list")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "list"
                    ? "bg-indigo-600 text-white shadow-xs font-bold"
                    : "text-slate-400 hover:text-slate-200"
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
      {filterSlot && (
        <div className="pt-2 border-t border-slate-800/80">{filterSlot}</div>
      )}
    </div>
  );
};

export default StickyControlBar;
