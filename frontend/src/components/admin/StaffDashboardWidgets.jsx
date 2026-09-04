import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  BookOpen,
  TrendingUp,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Layers,
  ShoppingBag,
  RotateCcw,
} from "lucide-react";
import { getStaffDashboardWidgets } from "../../api/collegeAdminApi";
import socket from "../../lib/socketClient";

export default function StaffDashboardWidgets({ collegeId }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staffDashboardWidgets", collegeId],
    queryFn: getStaffDashboardWidgets,
    enabled: !!collegeId,
    staleTime: 30000,
  });

  // Listen for real-time ILS events to keep widgets synchronized
  useEffect(() => {
    const handleSync = () => {
      queryClient.invalidateQueries({
        queryKey: ["staffDashboardWidgets", collegeId],
      });
    };

    socket.on("loan:checkout", handleSync);
    socket.on("loan:return", handleSync);
    socket.on("reservation:created", handleSync);
    socket.on("acquisition:updated", handleSync);

    return () => {
      socket.off("loan:checkout", handleSync);
      socket.off("loan:return", handleSync);
      socket.off("reservation:created", handleSync);
      socket.off("acquisition:updated", handleSync);
    };
  }, [collegeId, queryClient]);

  const widgetData = data?.data || {};
  const overdue = widgetData.overdue || { count: 0, items: [] };
  const holds = widgetData.holds || { count: 0, items: [] };
  const lowStock = widgetData.lowStock || { count: 0, items: [] };
  const activity = widgetData.todayActivity || {
    checkouts: 0,
    returns: 0,
    holdsPlaced: 0,
  };
  const popular = widgetData.popularThisWeek || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-slate-900 border border-slate-800 rounded-2xl"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 bg-slate-900 border border-slate-800 rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return null; // Gracefully degrade if staff widgets fail
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Real-time Activity Pulse Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Circulation Desk Pulse (Today)
            </h3>
            <p className="text-[11px] text-slate-400">
              Live automated feed synchronized via WebSocket
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Checkouts:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
              {activity.checkouts}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400">Returns:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
              {activity.returns}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Holds Placed:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
              {activity.holdsPlaced}
            </span>
          </div>
        </div>
      </div>

      {/* Main Staff Widgets: Overdue, Holds, Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Items Alert Widget */}
        <div className="bg-slate-900/90 border border-rose-500/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Overdue Loans
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Requires patron follow-up
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                {overdue.count} Overdue
              </span>
            </div>

            {overdue.items.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                All loans are currently within due dates!
              </div>
            ) : (
              <div className="space-y-2.5">
                {overdue.items.slice(0, 4).map((item) => (
                  <div
                    key={item._id}
                    className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate">
                      <p className="font-bold text-slate-200 truncate">
                        {item.book?.title || "Unknown Title"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Patron: {item.patron?.name || "Anonymous"} (
                        {item.patron?.studentId || "N/A"})
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      +{item.daysOverdue}d late
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/college-admin/circulation"
            className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors"
          >
            <span>Open Circulation Desk</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Active Holds Queue Widget */}
        <div className="bg-slate-900/90 border border-amber-500/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Active Hold Requests
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Patrons waiting for copies
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                {holds.count} Holds
              </span>
            </div>

            {holds.items.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <Bookmark className="w-8 h-8 text-amber-400/50 mx-auto mb-2" />
                No reservations pending pickup.
              </div>
            ) : (
              <div className="space-y-2.5">
                {holds.items.slice(0, 4).map((hold) => (
                  <div
                    key={hold._id}
                    className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate">
                      <p className="font-bold text-slate-200 truncate">
                        {hold.bookId?.title || "Reserved Title"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Patron: {hold.userId?.name || "Student"}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/college-admin/circulation"
            className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>Process Hold Queue</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Low Stock Warnings Widget */}
        <div className="bg-slate-900/90 border border-indigo-500/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Low Stock Alerts
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    ≤ 2 copies available
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                {lowStock.count} Low
              </span>
            </div>

            {lowStock.items.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <BookOpen className="w-8 h-8 text-cyan-400/50 mx-auto mb-2" />
                All titles have sufficient shelf inventory!
              </div>
            ) : (
              <div className="space-y-2.5">
                {lowStock.items.slice(0, 4).map((book) => (
                  <div
                    key={book._id}
                    className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate">
                      <p className="font-bold text-slate-200 truncate">
                        {book.title}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Shelf: {book.shelfLocation || "General Stacks"}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {book.copiesAvailable} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/college-admin/acquisitions"
            className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>Create Acquisition Order</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Popular Titles Spotlight Bar */}
      {popular.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Most Circulated Titles This Week
              </h4>
            </div>
            <Link
              to="/college-admin/analytics"
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Full Analytics <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {popular.map((item) => (
              <div
                key={item._id}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <p className="text-xs font-bold text-white line-clamp-2 leading-tight">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-1">
                    {item.author || "Unknown Author"}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500">
                    Circulation
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {item.checkouts} loans
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
