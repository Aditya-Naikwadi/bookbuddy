import { useState, useEffect, useCallback } from "react";
import { BookOpen, DollarSign, Search, Clock } from "lucide-react";
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
          <div className="font-semibold text-slate-900 text-xs">
            {val?.name || "Unknown User"}
          </div>
          <div className="text-[11px] text-slate-500 font-normal">
            ID: {val?.studentId || "N/A"} · {val?.email}
          </div>
        </div>
      ),
    },
    {
      header: "Book Title",
      key: "bookId",
      render: (val) => (
        <div>
          <div className="font-semibold text-indigo-600 text-xs">
            {val?.title || "Book Record"}
          </div>
          <div className="text-[11px] text-slate-500 font-normal">
            ISBN: {val?.isbn || "N/A"}
          </div>
        </div>
      ),
    },
    {
      header: "College Tenant",
      key: "collegeId",
      render: (val) => (
        <span className="text-xs text-slate-700 font-medium">
          {val?.name ? `${val.name} (${val.code})` : "Global Scope"}
        </span>
      ),
    },
    {
      header: "Issue / Due Date",
      key: "issueDate",
      render: (_, row) => (
        <div className="text-xs text-slate-600 font-medium">
          <div>
            Issued:{" "}
            {row.issueDate
              ? new Date(row.issueDate).toLocaleDateString()
              : "N/A"}
          </div>
          <div>
            Due:{" "}
            <strong className="text-amber-700">
              {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "N/A"}
            </strong>
          </div>
        </div>
      ),
    },
    {
      header: "Loan Status",
      key: "status",
      render: (val) => (
        <OpsSeverityBadge
          status={
            val === "overdue"
              ? "critical"
              : val === "active"
                ? "active"
                : "healthy"
          }
          label={val ? val.charAt(0).toUpperCase() + val.slice(1) : "Active"}
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
          <div className="font-semibold text-slate-900 text-xs">
            {val?.name || "Unknown User"}
          </div>
          <div className="text-[11px] text-slate-500 font-normal">
            ID: {val?.studentId || "N/A"} · {val?.email}
          </div>
        </div>
      ),
    },
    {
      header: "Fine Amount",
      key: "amount",
      render: (val) => (
        <span className="font-semibold text-amber-700 text-xs">
          ₹{(val || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: "College Tenant",
      key: "collegeId",
      render: (val) => (
        <span className="text-xs text-slate-700 font-medium">
          {val?.name ? `${val.name} (${val.code})` : "Global Scope"}
        </span>
      ),
    },
    {
      header: "Reason / Date",
      key: "reason",
      render: (val, row) => (
        <div className="text-xs text-slate-600 font-medium">
          <div>{val || "Overdue Book Return"}</div>
          <div className="text-slate-400 font-normal text-[11px]">
            Date: {new Date(row.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      header: "Payment Status",
      key: "status",
      render: (val) => (
        <OpsSeverityBadge
          status={val === "unpaid" ? "warning" : "healthy"}
          label={val === "unpaid" ? "Unpaid" : "Paid"}
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
          <div className="font-semibold text-slate-900 text-xs">{val}</div>
          <div className="text-[11px] text-slate-500 font-normal">
            Author: {row.author || "Unknown"} · ISBN: {row.isbn || "N/A"}
          </div>
        </div>
      ),
    },
    {
      header: "College Tenant Scope",
      key: "collegeId",
      render: (val) => (
        <span className="text-xs font-semibold text-indigo-600">
          {val?.name ? `${val.name} (${val.code})` : "Global Shared"}
        </span>
      ),
    },
    {
      header: "Inventory Copies",
      key: "totalCopies",
      render: (val, row) => (
        <span className="text-xs font-semibold text-emerald-700">
          {row.availableCopies || val || 1} / {val || 1} Available
        </span>
      ),
    },
    {
      header: "Category / Genre",
      key: "genre",
      render: (val, row) => (
        <span className="text-xs text-slate-600 font-normal">
          {val || row.category || "General"}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <OpsHeader
        title="Global Circulation & Fines Oversight"
        subtitle="Cross-tenant oversight of active book loans, fine collection logs, and global catalog holdings"
        onRefresh={fetchTabContent}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-xs font-semibold shadow-xs">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200/80">
          <button
            onClick={() => {
              setActiveTab("loans");
              setStatusFilter("");
            }}
            className={`px-6 py-3 text-xs font-semibold tracking-wide flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "loans"
                ? "border-indigo-600 text-indigo-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
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
            className={`px-6 py-3 text-xs font-semibold tracking-wide flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "fines"
                ? "border-amber-600 text-amber-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Fines & Collections</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("catalog");
              setStatusFilter("");
            }}
            className={`px-6 py-3 text-xs font-semibold tracking-wide flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "catalog"
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Global Catalog Holdings</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">
                Tenant Scope:
              </span>
              <select
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
              >
                <option value="">All Institutional Tenants</option>
                {colleges.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {activeTab !== "catalog" && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">
                  Filter Status:
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
                >
                  <option value="">All Statuses</option>
                  {activeTab === "loans" ? (
                    <>
                      <option value="active">Active Loans</option>
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
              </div>
            )}
          </div>

          {activeTab === "catalog" && (
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search global catalog..."
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-indigo-500 shadow-xs"
              />
            </div>
          )}
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
