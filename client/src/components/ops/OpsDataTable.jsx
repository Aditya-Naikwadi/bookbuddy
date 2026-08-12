import React, { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Filter,
  RefreshCw,
  Download,
} from "lucide-react";

/**
 * OpsDataTable
 * High-density, keyboard-accessible, sortable & filterable tabular component
 * tailored for BookBuddy internal operations tools.
 */
export function OpsDataTable({
  columns = [],
  data = [],
  isLoading = false,
  searchPlaceholder = "Filter entries across fields...",
  emptyMessage = "No matching log records found in current scope.",
  actions = null,
  initialSortField = "",
  initialSortDirection = "asc",
  exportFilename = "bookbuddy_export.csv",
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState(initialSortField);
  const [sortDirection, setSortDirection] = useState(initialSortDirection);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const handleSort = (fieldKey) => {
    if (!fieldKey) return;
    if (sortField === fieldKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(fieldKey);
      setSortDirection("asc");
    }
  };

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

  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleExportCsv = () => {
    if (!sortedData.length) return;
    const headerRow = columns
      .map((col) => `"${col.header.replace(/"/g, '""')}"`)
      .join(",");
    const bodyRows = sortedData.map((row) =>
      columns
        .map((col) => {
          let val = row[col.key];
          if (typeof val === "object" && val !== null) {
            val = val.name || val.title || val.email || JSON.stringify(val);
          }
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl font-mono text-xs">
      {/* Top Filter & Toolbar Bar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 ml-auto text-[11px] text-slate-400">
          {actions}
          <button
            onClick={handleExportCsv}
            disabled={!sortedData.length}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-300 font-bold rounded flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CSV</span>
          </button>
          <span className="text-slate-700">|</span>
          <span>
            SHOWING{" "}
            <strong className="text-slate-200">{paginatedData.length}</strong>{" "}
            OF <strong className="text-slate-200">{sortedData.length}</strong>{" "}
            RECORDS
          </span>
        </div>
      </div>

      {/* Main High-Density Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold select-none">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-3 py-2.5 border-r border-slate-800/50 last:border-r-0 ${
                    col.sortable !== false
                      ? "cursor-pointer hover:bg-slate-900/60 hover:text-slate-200"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-slate-600">
                        {sortField === col.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-700 hover:text-slate-400" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-500"
                >
                  <div className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>QUERYING INTERNAL DATABASE RECORDS...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-500 font-mono"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={row._id || row.id || idx}
                  className="hover:bg-slate-850/80 transition-colors border-b border-slate-800/40 text-slate-300"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-2 border-r border-slate-800/40 last:border-r-0 whitespace-nowrap align-middle"
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="text-[11px]">
            PAGE <strong className="text-white">{currentPage}</strong> OF{" "}
            <strong className="text-white">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition-colors"
            >
              PREV
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition-colors"
            >
              NEXT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OpsDataTable;
