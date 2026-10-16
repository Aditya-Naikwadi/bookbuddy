import { useState, useEffect } from "react";
import { Building2, Layers, AlertTriangle, Package } from "lucide-react";
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

      {/* Live Physical Inventory Explorer */}
      <InventoryExplorer />
    </div>
  );
}

function InventoryExplorer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [shelfLocation, setShelfLocation] = useState("");
  const [availability, setAvailability] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: [
      "inventory",
      {
        q: debouncedSearch,
        genre: selectedGenre,
        shelfLocation,
        availability,
        page,
      },
    ],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (selectedGenre !== "all") params.set("genre", selectedGenre);
      if (shelfLocation) params.set("shelfLocation", shelfLocation);
      if (availability !== "all") params.set("availability", availability);

      const res = await fetch(`/api/v1/inventory?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return await res.json();
    },
    keepPreviousData: true,
  });

  const items = inventoryData?.data || [];
  const pagination = inventoryData?.pagination || { total: 0, pages: 1 };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Master Inventory Explorer & Shelf Locator</span>
          </h2>
          <p className="text-[11px] text-slate-400 font-sans mt-0.5">
            Role-scoped Dewey Decimal, shelf aisle coordinates, call numbers,
            and acquisition values.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Search title, author, ISBN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <input
          type="text"
          placeholder="Shelf location prefix (e.g. A3)..."
          value={shelfLocation}
          onChange={(e) => {
            setShelfLocation(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={selectedGenre}
          onChange={(e) => {
            setSelectedGenre(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Genres</option>
          <option value="Computer Science">Computer Science</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Physics">Physics</option>
          <option value="Literature">Literature</option>
          <option value="Engineering">Engineering</option>
        </select>
        <select
          value={availability}
          onChange={(e) => {
            setAvailability(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Availability</option>
          <option value="available">Available in Stock</option>
          <option value="unavailable">All Copies Checked Out</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
            <tr>
              <th className="p-3">Title & Author</th>
              <th className="p-3">ISBN</th>
              <th className="p-3">Dewey Decimal</th>
              <th className="p-3">Shelf Location</th>
              <th className="p-3">Call Number</th>
              <th className="p-3">Copies (Avail / Tot)</th>
              <th className="p-3">Acquisition Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-300">
            {isLoading ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-500">
                  Loading inventory records...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-500">
                  No matching inventory records found.
                </td>
              </tr>
            ) : (
              items.map((book) => (
                <tr key={book._id} className="hover:bg-slate-800/40">
                  <td className="p-3">
                    <div className="font-bold text-white line-clamp-1">
                      {book.title}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {book.author}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-slate-400">
                    {book.isbn || "—"}
                  </td>
                  <td className="p-3 font-mono text-indigo-400">
                    {book.deweyDecimal || "—"}
                  </td>
                  <td className="p-3 font-mono text-emerald-400 font-semibold">
                    {book.shelfLocation || "—"}
                  </td>
                  <td className="p-3 font-mono text-amber-400">
                    {book.callNumber || "—"}
                  </td>
                  <td className="p-3 font-mono">
                    <span
                      className={
                        book.copiesAvailable > 0
                          ? "text-emerald-400 font-bold"
                          : "text-rose-400 font-bold"
                      }
                    >
                      {book.copiesAvailable}
                    </span>
                    <span className="text-slate-500">
                      {" "}
                      / {book.copiesTotal}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-300">
                    {book.purchasePrice != null
                      ? `₹${book.purchasePrice.toFixed(2)}`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800">
          <span>
            Page {pagination.page || 1} of {pagination.pages} (
            {pagination.total} records)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 bg-slate-950 border border-slate-800 rounded disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 bg-slate-950 border border-slate-800 rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
