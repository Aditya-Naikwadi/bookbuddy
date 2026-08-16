import {
  Building2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Package,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function InventoryOverview() {
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["analyticsSummaryInventory"],
    queryFn: () => collegeAdminApi.getAnalyticsSummary(),
  });

  const { data: queueData } = useQuery({
    queryKey: ["circulationQueue"],
    queryFn: () => collegeAdminApi.getCirculationQueue(),
  });

  const stats = summaryData?.data || summaryData || {};
  const activeLoans = queueData?.activeLoans || [];
  const reservations = queueData?.reservations || [];
  const categoryBreakdown = stats.categoryBreakdown || [];
  const stockAlerts = stats.stockAlerts || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-mono">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
            Campus Inventory & Stock Control
          </span>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Physical Stock & Holdings Overview
          </h1>
          <p className="text-xs font-sans text-slate-400 mt-1">
            Real-time physical copy inventory, category distribution, active
            holds, and low-stock alerts.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="uppercase font-bold">Catalog Titles</span>
            <Package size={18} className="text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">
            {isSummaryLoading
              ? "..."
              : (stats.catalogSize || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Unique shelf catalog entries
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="uppercase font-bold">On Loan Copies</span>
            <Layers size={18} className="text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400">
            {stats.activeLoans || activeLoans.length || 0}
          </div>
          <div className="text-[11px] text-slate-500">
            Currently checked out
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="uppercase font-bold">Pending Holds</span>
            <Building2 size={18} className="text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-400">
            {reservations.length}
          </div>
          <div className="text-[11px] text-slate-500">
            Awaiting counter pickup
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span className="uppercase font-bold">Low-Stock Alerts</span>
            <AlertTriangle size={18} className="text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400">
            {stockAlerts.length}
          </div>
          <div className="text-[11px] text-slate-500 font-sans">
            Titles with ≤ 2 copies available
          </div>
        </div>
      </div>

      {/* Stock Alert Warning Section */}
      {stockAlerts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Low Stock / High Demand Inventory Alerts</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Book Title</th>
                  <th className="p-3">Author</th>
                  <th className="p-3">ISBN</th>
                  <th className="p-3">Available Copies</th>
                  <th className="p-3">Total Copies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {stockAlerts.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{item.title}</td>
                    <td className="p-3">{item.author}</td>
                    <td className="p-3 font-mono text-slate-400">
                      {item.isbn || "N/A"}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold rounded">
                        {item.availableCopies} Left
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{item.totalCopies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Category & Subject Inventory Breakdown</span>
        </h2>

        {categoryBreakdown.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-sans">
            No category distribution data logged yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryBreakdown.map((cat, i) => (
              <div
                key={i}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">
                    {cat.category}
                  </span>
                  <span className="text-indigo-400 font-bold">
                    {cat.count} Titles
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Total Physical Stock Copies:{" "}
                  <span className="text-white font-bold">
                    {cat.totalCopies}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
