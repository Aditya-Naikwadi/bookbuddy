import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  DollarSign,
  Layers,
  Search,
  Building,
  RefreshCw,
  Clock,
  CheckCircle,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsDataTable from "../../../components/ops/OpsDataTable";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";

export default function GlobalDataOversight() {
  const [activeTab, setActiveTab] = useState("loans");
  const [colleges, setColleges] = useState([]);
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters State
  const [search, setSearch] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const fetchTabContent = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let isMounted = true;
    async function loadColleges() {
      try {
        const list = await adminApi.listColleges();
        if (isMounted) setColleges(list || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadColleges();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        setError("");
        let res;

        if (activeTab === "loans") {
          res = await adminApi.getGlobalLoans({
            status: statusFilter || undefined,
            collegeId: collegeFilter || undefined,
          });
        } else if (activeTab === "fines") {
          res = await adminApi.getGlobalFines({
            status: statusFilter || undefined,
            collegeId: collegeFilter || undefined,
          });
        } else if (activeTab === "catalog") {
          res = await adminApi.getGlobalCatalog({
            search: search || undefined,
            collegeId: collegeFilter || undefined,
          });
        }

        if (isMounted) setData(res?.data || []);
      } catch (err) {
        console.error(err);
        if (isMounted) setError(`Failed to fetch global ${activeTab} data.`);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeTab, reloadToken, search, collegeFilter, statusFilter]);

  // Column definitions per tab
  const loanColumns = [
    {
      header: "Patron / Student",
      key: "userId",
      render: (val) => (
        <div>
          <div className="font-bold text-white text-xs">{val?.name || "Unknown User"}</div>
          <div className="text-[10px] text-slate-400 font-mono">
            {val?.studentId || "N/A"} | {val?.email}
          </div>
        </div>
      ),
    },
    {
      header: "Book Title",
      key: "bookId",
      render: (val) => (
        <div>
          <div className="font-bold text-indigo-300 text-xs">{val?.title || "Book Record"}</div>
          <div className="text-[10px] text-slate-500 font-mono">ISBN: {val?.isbn || "N/A"}</div>
        </div>
      ),
    },
    {
      header: "College Tenant",
      key: "collegeId",
      render: (val) => (
        <span className="text-xs font-mono text-slate-300 font-bold">
          {val?.name ? `${val.name} (${val.code})` : "Global"}
        </span>
      ),
    },
    {
      header: "Issue / Due Date",
      key: "issueDate",
      render: (_, row) => (
        <div className="text-[10px] font-mono text-slate-400">
          <div>Issued: {row.issueDate ? new Date(row.issueDate).toLocaleDateString() : "N/A"}</div>
          <div>Due: <strong className="text-amber-300">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "N/A"}</strong></div>
        </div>
      ),
    },
    {
      header: "Loan Status",
      key: "status",
      render: (val) => (
        <OpsSeverityBadge
          status={val === "overdue" ? "critical" : val === "active" ? "active" : "healthy"}
          label={(val || "active").toUpperCase()}
          size="sm"
        />
      ),
    },
  ];

  const fineColumns = [
    {
      header: "Patron / Student",
      key: "userId",
      render: (val) => (
        <div>
          <div className="font-bold text-white text-xs">{val?.name || "Unknown User"}</div>
          <div className="text-[10px] text-slate-400 font-mono">
            {val?.studentId || "N/A"} | {val?.email}
          </div>
        </div>
      ),
    },
    {
      header: "Fine Amount",
      key: "amount",
      render: (val) => (
        <span className="font-mono text-amber-400 font-bold text-xs">
          ${(val || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "College Tenant",
      key: "collegeId",
      render: (val) => (
        <span className="text-xs font-mono text-slate-300 font-bold">
          {val?.name ? `${val.name} (${val.code})` : "Global"}
        </span>
      ),
    },
    {
      header: "Reason / Date",
      key: "reason",
      render: (val, row) => (
        <div className="text-[10px] font-mono text-slate-400">
          <div>{val || "Overdue Book Return"}</div>
          <div className="text-slate-500">Date: {new Date(row.createdAt).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      header: "Payment Status",
      key: "status",
      render: (val) => (
        <OpsSeverityBadge
          status={val === "unpaid" ? "warning" : "healthy"}
          label={(val || "unpaid").toUpperCase()}
          size="sm"
        />
      ),
    },
  ];

  const catalogColumns = [
    {
      header: "Book Details",
      key: "title",
      render: (val, row) => (
        <div>
          <div className="font-bold text-white text-xs">{val}</div>
          <div className="text-[10px] text-slate-400 font-mono">
            Author: {row.author || "Unknown"} | ISBN: {row.isbn || "N/A"}
          </div>
        </div>
      ),
    },
    {
      header: "College Tenant Scope",
      key: "collegeId",
      render: (val) => (
        <span className="text-xs font-mono text-indigo-300 font-bold">
          {val?.name ? `${val.name} (${val.code})` : "Global Shared"}
        </span>
      ),
    },
    {
      header: "Inventory Copies",
      key: "totalCopies",
      render: (val, row) => (
        <span className="text-xs font-mono text-emerald-400 font-bold">
          {row.availableCopies || val || 1} / {val || 1} Available
        </span>
      ),
    },
    {
      header: "Category / Genre",
      key: "genre",
      render: (val, row) => (
        <span className="text-xs font-mono text-slate-400">
          {val || row.category || "General"}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <OpsHeader
        title="MODULE 04 // CROSS-TENANT DATA OVERSIGHT WORKSPACE"
        subtitle="Global inspection and governance over active loans, overdue fines, and catalog holdings across all institutions"
        onRefresh={fetchTabContent}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-950/60 border border-rose-700/60 p-3 rounded-lg text-rose-300 font-mono text-xs">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 font-mono">
          <button
            onClick={() => {
              setActiveTab("loans");
              setStatusFilter("");
            }}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "loans"
                ? "border-indigo-500 text-indigo-400 bg-slate-900/60"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Circulation & Loans</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("fines");
              setStatusFilter("");
            }}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "fines"
                ? "border-amber-500 text-amber-400 bg-slate-900/60"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Global Fines & Ledger</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("catalog");
              setStatusFilter("");
            }}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "catalog"
                ? "border-emerald-500 text-emerald-400 bg-slate-900/60"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Global Book Catalog</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {activeTab === "catalog" && (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search title, author, ISBN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Institutions</option>
              {colleges.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            {activeTab !== "catalog" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                {activeTab === "loans" ? (
                  <>
                    <option value="active">Active</option>
                    <option value="overdue">Overdue</option>
                    <option value="returned">Returned</option>
                  </>
                ) : (
                  <>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </>
                )}
              </select>
            )}
          </div>
        </div>

        {/* Data Table */}
        <OpsDataTable
          columns={
            activeTab === "loans"
              ? loanColumns
              : activeTab === "fines"
              ? fineColumns
              : catalogColumns
          }
          data={data}
          isLoading={isLoading}
          searchPlaceholder={`Filter global ${activeTab} records...`}
          emptyMessage={`No ${activeTab} records found matching specified criteria.`}
        />
      </main>
    </div>
  );
}
