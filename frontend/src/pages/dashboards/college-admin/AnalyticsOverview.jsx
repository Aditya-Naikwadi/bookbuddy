import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  Activity,
  Loader2,
  Download,
  FileSpreadsheet,
  Printer,
  Filter,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";
import PermissionGate from "../../../components/common/PermissionGate";

export default function AnalyticsOverview() {
  const [reportType, setReportType] = useState("circulation"); // circulation | popular | overdue | inventory
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ["analyticsSummaryDetailed"],
    queryFn: () => collegeAdminApi.getAnalyticsSummary(),
  });

  const stats = summaryData?.data || summaryData || {};
  const topBooks = stats.topBooks || [];
  const deptUtil = stats.departmentUtilization || [];

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await collegeAdminApi.getCustomReport(reportType, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setReportData(res.data);
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToCsv = () => {
    if (!reportData || !reportData.records || reportData.records.length === 0)
      return;

    const records = reportData.records;
    let headers = [];
    let rows = [];

    if (reportType === "circulation") {
      headers = [
        "Loan ID",
        "Book Title",
        "Author",
        "ISBN",
        "Patron Name",
        "Status",
        "Borrow Date",
        "Due Date",
      ];
      rows = records.map((r) => [
        r._id,
        `"${(r.bookId?.title || "").replace(/"/g, '""')}"`,
        `"${(r.bookId?.author || "").replace(/"/g, '""')}"`,
        r.bookId?.isbn || "",
        `"${(r.userId?.name || "").replace(/"/g, '""')}"`,
        r.status,
        r.borrowDate ? new Date(r.borrowDate).toLocaleDateString() : "",
        r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "",
      ]);
    } else if (reportType === "overdue") {
      headers = [
        "Loan ID",
        "Book Title",
        "ISBN",
        "Shelf",
        "Patron Name",
        "Student ID",
        "Due Date",
      ];
      rows = records.map((r) => [
        r._id,
        `"${(r.bookId?.title || "").replace(/"/g, '""')}"`,
        r.bookId?.isbn || "",
        `"${(r.bookId?.shelfLocation || "").replace(/"/g, '""')}"`,
        `"${(r.userId?.name || "").replace(/"/g, '""')}"`,
        r.userId?.studentId || "",
        r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "",
      ]);
    } else if (reportType === "popular") {
      headers = [
        "Book Title",
        "Author",
        "ISBN",
        "Category",
        "Copies",
        "Checkouts",
      ];
      rows = records.map((r) => [
        `"${(r.title || "").replace(/"/g, '""')}"`,
        `"${(r.author || "").replace(/"/g, '""')}"`,
        r.isbn || "",
        r.category || "",
        r.copies || 0,
        r.checkouts || 0,
      ]);
    } else if (reportType === "inventory") {
      headers = [
        "Book Title",
        "Author",
        "ISBN",
        "Category",
        "Total Copies",
        "Available Copies",
        "Shelf Location",
      ];
      rows = records.map((r) => [
        `"${(r.title || "").replace(/"/g, '""')}"`,
        `"${(r.author || "").replace(/"/g, '""')}"`,
        r.isbn || "",
        r.category || "",
        r.copies || 0,
        r.copiesAvailable || 0,
        `"${(r.shelfLocation || "").replace(/"/g, '""')}"`,
      ]);
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `bookbuddy_${reportType}_report_${Date.now()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-sans">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
            ILS MODULE 06 — REPORTING & ANALYTICS
          </span>
          <h1 className="text-3xl font-serif font-bold text-white mt-2">
            Circulation Trends & Official Reports
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Generate and export audit-ready institutional reports, circulation
            summaries, and collection analytics.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2 font-mono">
          <Loader2 className="animate-spin text-indigo-400" size={20} /> Loading
          campus analytics summary...
        </div>
      ) : (
        <>
          {/* Core Metric Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase font-bold">Total Patrons</span>
                <Users size={18} className="text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {(stats.totalStudents || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Enrolled campus students
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase font-bold">Catalog Holdings</span>
                <BookOpen size={18} className="text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {(stats.catalogSize || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Physical catalog titles
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase font-bold">Active Circulation</span>
                <TrendingUp size={18} className="text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {stats.activeLoans || 0}
              </div>
              <div className="text-[11px] text-slate-500">
                Current patron loans
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase font-bold">Lab Utilization</span>
                <Activity size={18} className="text-cyan-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-cyan-400">
                {Math.round((stats.labUtilizationRate || 0) * 100)}%
              </div>
              <div className="text-[11px] text-slate-500">
                Capacity booked rate
              </div>
            </div>
          </div>

          {/* Department Utilization & Top Borrowed Leaderboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Borrowed Titles */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3 font-mono">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Top Borrowed Titles Leaderboard</span>
              </h2>

              {topBooks.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No circulation leaderboard records logged yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {topBooks.map((book, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center font-mono">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white line-clamp-1">
                            {book.title}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {book.author}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 shrink-0">
                        {book.count} Loans
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Department Utilization Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3 font-mono">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Department Circulation Breakdown</span>
              </h2>

              {deptUtil.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No department engagement metrics calculated yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {deptUtil.map((dept, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-4"
                    >
                      <span className="text-xs font-bold text-slate-200">
                        {dept.department || "General"}
                      </span>
                      <span className="text-xs font-bold font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                        {dept.loanCount} Loan(s)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Report Generator & Export Desk */}
          <PermissionGate permission="canViewAnalytics">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="text-indigo-400" size={20} />
                    <span>Report Generation & Institutional Export</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Export high-fidelity reports for administrative compliance,
                    NAAC accreditation, and internal reviews.
                  </p>
                </div>

                {reportData && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportToCsv}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      <Download size={14} />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={printReport}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Printer size={14} />
                      <span>Print / PDF</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Generator Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                    Report Type
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="circulation">Circulation History</option>
                    <option value="overdue">Overdue Loans Audit</option>
                    <option value="popular">Most Popular Titles</option>
                    <option value="inventory">Shelf Inventory Status</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <button
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                    className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Filter size={14} />
                        <span>Generate Report</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Report Data Preview Table */}
              {reportData && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-300 uppercase">
                      Generated Records ({reportData.records?.length || 0})
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Timestamp:{" "}
                      {new Date(reportData.generatedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-96 border border-slate-800 rounded-2xl">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] sticky top-0 uppercase border-b border-slate-800">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Title / Item</th>
                          <th className="p-3">Details</th>
                          <th className="p-3">Metric / Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/50 font-mono">
                        {reportData.records?.slice(0, 50).map((record, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-3 text-slate-500">{idx + 1}</td>
                            <td className="p-3 font-bold text-white font-sans">
                              {record.title ||
                                record.bookId?.title ||
                                "Item Record"}
                            </td>
                            <td className="p-3 text-slate-400">
                              {record.author ||
                                record.bookId?.author ||
                                record.userId?.name ||
                                "N/A"}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                                {record.status ||
                                  `${record.checkouts || record.copies || 0} count`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </PermissionGate>
        </>
      )}
    </div>
  );
}
