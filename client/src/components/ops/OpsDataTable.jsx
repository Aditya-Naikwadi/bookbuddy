import { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  RefreshCw,
  Download,
} from "lucide-react";
import NoAuditEvents from "./illustrations/NoAuditEvents";

/**
 * OpsDataTable
 * High-density, keyboard-accessible, sortable & filterable tabular component
 * tailored for BookBuddy internal operations tools.
 */
export default function OpsDataTable({
  columns = [],
  data = [],
  isLoading = false,
  searchPlaceholder = "Search records...",
  emptyMessage = "No matching operational records found.",
  exportFilename = "operational-export.csv",
  actions = null,
  selectable = false,
  selectedIds = new Set(),
  onSelectRow = null,
  onSelectAll = null,
  batchActions = null,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      }),
    );
  }, [data, searchTerm, columns]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      return sortDirection === "asc" ? 1 : -1;
    });
  }, [filteredData, sortField, sortDirection]);

  // Paginate sorted data
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage]);

  const handleSort = (key) => {
    if (sortField === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(key);
      setSortDirection("asc");
    }
  };

  const handleExportCsv = () => {
    if (!sortedData.length) return;
    const headers = columns.map((col) => col.header || col.key);
    const headerRow = headers.map((h) => `"${h}"`).join(",");
    const bodyRows = sortedData.map((row) =>
      columns
        .map((col) => {
          const val = row[col.key];
          if (val === null || val === undefined) return '""';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(","),
    );

    const csvContent =
      "data:text/csv;charset=utf-8," + [headerRow, ...bodyRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAllSelected = useMemo(() => {
    if (!paginatedData.length) return false;
    return paginatedData.every((r) => selectedIds?.has(r._id || r.id));
  }, [paginatedData, selectedIds]);

  const handleMasterCheckboxChange = () => {
    if (!onSelectAll) return;
    const visibleIds = paginatedData.map((r) => r._id || r.id);
    onSelectAll(visibleIds);
  };

  return (
    <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl overflow-hidden shadow-xs font-sans text-xs">
      {/* Top Filter & Toolbar Bar */}
      <div className="p-3.5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-edge flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-ink placeholder-slate-400 dark:placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-xs"
          />
        </div>

        <div className="flex items-center gap-3 ml-auto text-xs text-slate-600 dark:text-slate-300 font-medium">
          {selectable && selectedIds?.size > 0 && batchActions && (
            <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-edge">
              {batchActions}
            </div>
          )}
          {actions}
          <button
            onClick={handleExportCsv}
            disabled={!sortedData.length}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-edge text-xs font-semibold text-slate-600 dark:text-slate-300 select-none">
              {selectable && (
                <th className="px-4 py-3 border-r border-slate-200/40 dark:border-slate-700/40 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleMasterCheckboxChange}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 border-r border-slate-200/40 dark:border-slate-700/40 last:border-r-0 ${
                    col.sortable !== false
                      ? "cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-slate-400">
                        {sortField === col.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr
                  key={`skeleton-row-${rIdx}`}
                  className="animate-pulse border-b border-slate-100 dark:border-slate-800/80"
                >
                  {selectable && (
                    <td className="px-4 py-3 text-center">
                      <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
                    </td>
                  )}
                  {columns.map((col, cIdx) => (
                    <td key={`skeleton-cell-${cIdx}`} className="px-4 py-3">
                      <div
                        className="h-4 bg-slate-200 dark:bg-slate-800 rounded"
                        style={{
                          width:
                            cIdx === 0 ? "70%" : cIdx % 2 === 0 ? "50%" : "85%",
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={selectable ? columns.length + 1 : columns.length}
                  className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <NoAuditEvents className="w-16 h-16 opacity-80" />
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const rowId = row._id || row.id || idx;
                const isSelected = selectedIds?.has(rowId);
                return (
                  <tr
                    key={rowId}
                    className={`transition-colors text-slate-700 dark:text-slate-300 font-normal ${
                      isSelected
                        ? "bg-indigo-50/60 dark:bg-indigo-950/40"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    {selectable && (
                      <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 text-center">
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => onSelectRow && onSelectRow(rowId)}
                          className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 last:border-r-0 whitespace-nowrap align-middle"
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : (row[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-edge flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
          <div>
            Page{" "}
            <strong className="text-slate-900 dark:text-ink">
              {currentPage}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-900 dark:text-ink">
              {totalPages}
            </strong>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors shadow-xs"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors shadow-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
