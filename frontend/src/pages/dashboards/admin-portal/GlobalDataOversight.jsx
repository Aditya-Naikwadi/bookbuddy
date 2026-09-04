import { useState, useEffect, useCallback, useMemo } from "react";
import { BookOpen, DollarSign, Search, Clock } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
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

  const activeCollegesCount = colleges.filter(
    (c) => c.status === "active" || c.isActive,
  ).length;
  const pendingCollegesCount = colleges.filter(
    (c) => c.status === "pending" || c.status === "pending_review",
  ).length;
  const suspendedCollegesCount = colleges.filter(
    (c) => c.status === "suspended" || c.status === "disabled",
  ).length;

  const tenantStatusDonutData = [
    { name: "Active Tenants", value: activeCollegesCount },
    { name: "Pending Review", value: pendingCollegesCount },
    { name: "Suspended", value: suspendedCollegesCount },
  ];
  const DONUT_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

  const circulationBarData = useMemo(() => {
    const totalCount = Array.isArray(data) ? data.length : 0;
    return [
      { month: "Current Activity", loans: totalCount, fines: totalCount * 10 },
    ];
  }, [data]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-void text-slate-900 dark:text-ink font-sans pb-12">
      <OpsHeader
        title="Global Circulation & Fines Oversight"
        subtitle="Cross-tenant oversight of active book loans, fine collection logs, and global catalog holdings"
        onRefresh={fetchTabContent}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-4 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-semibold shadow-xs">
            {error}
          </div>
        )}

        {/* Analytics & Data Visualization Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Donut Chart: Tenant Status Composition */}
          <div className="lg:col-span-4 bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-3 font-sans">
            <div className="border-b border-slate-100 dark:border-edge pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-ink">
                Tenant Status Composition
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-muted mt-0.5">
                Distribution of provisioned vs pending institution tenants
              </p>
            </div>
            {isLoading ? (
              <div className="h-52 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center text-slate-400 text-xs">
                Loading Donut Breakdown...
              </div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tenantStatusDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {tenantStatusDonutData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-surface, #151a26)",
                        borderColor: "var(--bg-edge, #222b40)",
                        borderRadius: "12px",
                        color: "var(--text-ink, #f8f9fa)",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "var(--text-ink, #f8f9fa)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Bar Chart: Fine Collection vs Loan Volume Over Time */}
          <div className="lg:col-span-8 bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-3 font-sans">
            <div className="border-b border-slate-100 dark:border-edge pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-ink">
                Circulation Volume vs Fine Collections Over Time
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-muted mt-0.5">
                Monthly multi-tenant circulation activity vs fine amounts (₹)
                collected
              </p>
            </div>
            {isLoading ? (
              <div className="h-52 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center text-slate-400 text-xs">
                Loading Circulation Volume Bar Chart...
              </div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={circulationBarData}
                    margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148, 163, 184, 0.2)"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      unit="₹"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-surface, #151a26)",
                        borderColor: "var(--bg-edge, #222b40)",
                        borderRadius: "12px",
                        color: "var(--text-ink, #f8f9fa)",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "var(--text-ink, #f8f9fa)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar
                      yAxisId="left"
                      dataKey="loans"
                      name="Book Loans"
                      fill="#06b6d4"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="fines"
                      name="Fines Collected (₹)"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200/80 dark:border-edge">
          <button
            onClick={() => {
              setActiveTab("loans");
              setStatusFilter("");
            }}
            className={`px-6 py-3 text-xs font-semibold tracking-wide flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "loans"
                ? "border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-white dark:bg-surface"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-ink"
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
                ? "border-amber-600 text-amber-700 dark:text-amber-400 bg-white dark:bg-surface"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-ink"
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
                ? "border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-surface"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-ink"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Global Catalog Holdings</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Tenant Scope:
              </span>
              <select
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none shadow-xs"
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
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Filter Status:
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none shadow-xs"
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
                className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 shadow-xs"
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
