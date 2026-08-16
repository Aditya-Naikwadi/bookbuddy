import { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
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
  searchPlaceholder = "Search entries across fields...",
  emptyMessage = "No matching records found in current view.",
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
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs font-sans text-xs">
      {/* Top Filter & Toolbar Bar */}
      <div className="p-3.5 bg-slate-50/50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
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
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-xs"
          />
        </div>

        <div className="flex items-center gap-3 ml-auto text-xs text-slate-600 font-medium">
          {actions}
          <button
            onClick={handleExportCsv}
            disabled={!sortedData.length}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export CSV</span>
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">
            Showing{" "}
            <strong className="text-slate-900">{paginatedData.length}</strong>{" "}
            of <strong className="text-slate-900">{sortedData.length}</strong>{" "}
            entries
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/80 text-xs font-semibold text-slate-600 select-none">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 border-r border-slate-200/40 last:border-r-0 ${
                    col.sortable !== false
                      ? "cursor-pointer hover:bg-slate-100/70 text-slate-700"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-slate-400">
                        {sortField === col.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-500"
                >
                  <div className="inline-flex items-center gap-2 font-medium">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Loading dataset records...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 text-slate-400 font-medium"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={row._id || row.id || idx}
                  className="hover:bg-slate-50/80 transition-colors text-slate-700 font-normal"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 border-r border-slate-100 last:border-r-0 whitespace-nowrap align-middle"
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
        <div className="p-3 bg-slate-50/50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-medium">
          <div>
            Page <strong className="text-slate-900">{currentPage}</strong> of{" "}
            <strong className="text-slate-900">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-xs"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OpsDataTable;
