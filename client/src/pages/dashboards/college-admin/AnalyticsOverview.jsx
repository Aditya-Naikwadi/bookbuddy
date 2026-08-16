import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  Clock,
  Activity,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function AnalyticsOverview() {
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ["analyticsSummaryDetailed"],
    queryFn: () => collegeAdminApi.getAnalyticsSummary(),
  });

  const stats = summaryData?.data || summaryData || {};
  const topBooks = stats.topBooks || [];
  const deptUtil = stats.departmentUtilization || [];
  const trends = stats.circulationTrends || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-mono">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
            Campus Intelligence & Analytics
          </span>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Circulation Trends & Usage Analytics
          </h1>
          <p className="text-xs font-sans text-slate-400 mt-1">
            Comprehensive usage telemetry across departments, circulation
            trends, most-borrowed titles, and lab utilization.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2 font-sans">
          <Loader2 className="animate-spin text-indigo-400" size={20} /> Loading
          campus analytics summary...
        </div>
      ) : (
        <>
          {/* Core Metric Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs">
                <span className="uppercase font-bold">Total Patrons</span>
                <Users size={18} className="text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">
                {(stats.totalStudents || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Enrolled campus students
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs">
                <span className="uppercase font-bold">Catalog Holdings</span>
                <BookOpen size={18} className="text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">
                {(stats.catalogSize || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Physical catalog titles
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs">
                <span className="uppercase font-bold">Active Circulation</span>
                <TrendingUp size={18} className="text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">
                {stats.activeLoans || 0}
              </div>
              <div className="text-[11px] text-slate-500">
                Current patron loans
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs">
                <span className="uppercase font-bold">Lab Utilization</span>
                <Activity size={18} className="text-cyan-400" />
              </div>
              <div className="text-3xl font-extrabold text-cyan-400">
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
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Top Borrowed Titles Leaderboard</span>
              </h2>

              {topBooks.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-sans">
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
                        <span className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center">
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
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 shrink-0">
                        {book.count} Loans
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Department Utilization Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Department Circulation Breakdown</span>
              </h2>

              {deptUtil.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-sans">
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
                      <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                        {dept.loanCount} Loan(s)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
