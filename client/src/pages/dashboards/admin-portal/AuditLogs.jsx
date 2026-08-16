import { useState, useEffect, useCallback } from "react";
import { Filter, User, Terminal, FileCode, Download } from "lucide-react";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";
import OpsDataTable from "../../../components/ops/OpsDataTable";
import { exportToCSV } from "../../../utils/csvExporter";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPayload, setSelectedPayload] = useState(null);

  // Advanced Filters
  const [actorRoleFilter, setActorRoleFilter] = useState("all");
  const [actionCategoryFilter, setActionCategoryFilter] = useState("all");

  const [reloadToken, setReloadToken] = useState(0);

  const fetchAuditLogs = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let ignore = false;
    async function loadLogs() {
      try {
        setIsLoading(true);
        const data = await adminApi.getAuditLogs();
        if (!ignore) setLogs(data || []);
      } catch (err) {
        console.error(err);
        if (!ignore) setError("Failed to fetch security audit logs.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    loadLogs();
    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  // Filter logs by actor role & action category
  const filteredLogs = logs.filter((log) => {
    if (actorRoleFilter !== "all" && log.actorRole !== actorRoleFilter)
      return false;
    if (actionCategoryFilter !== "all") {
      const action = (log.action || "").toLowerCase();
      if (
        actionCategoryFilter === "auth" &&
        !action.includes("auth") &&
        !action.includes("login")
      )
        return false;
      if (
        actionCategoryFilter === "tenant" &&
        !action.includes("tenant") &&
        !action.includes("registration") &&
        !action.includes("college")
      )
        return false;
      if (
        actionCategoryFilter === "security" &&
        !action.includes("security") &&
        !action.includes("mfa") &&
        !action.includes("forbidden")
      )
        return false;
    }
    return true;
  });

  const getActionSeverity = (action = "") => {
    const act = action.toLowerCase();
    if (
      act.includes("reject") ||
      act.includes("forbidden") ||
      act.includes("failed") ||
      act.includes("delete")
    )
      return "critical";
    if (
      act.includes("approve") ||
      act.includes("create") ||
      act.includes("submit") ||
      act.includes("onboarding")
    )
      return "warning";
    if (act.includes("login") || act.includes("verify") || act.includes("auth"))
      return "healthy";
    return "info";
  };

  const columns = [
    {
      header: "Timestamp",
      key: "createdAt",
      render: (val) => {
        const dateStr = val
          ? new Date(val).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "—";
        return (
          <span className="text-xs text-slate-700 font-medium">{dateStr}</span>
        );
      },
    },
    {
      header: "Action / Event",
      key: "action",
      render: (val) => (
        <div className="flex items-center gap-2">
          <OpsSeverityBadge status={getActionSeverity(val)} size="sm" />
          <span className="font-semibold text-slate-900 text-xs">
            {val || "SYSTEM_EVENT"}
          </span>
        </div>
      ),
    },
    {
      header: "Actor Identity",
      key: "actorName",
      render: (val, row) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span>{val || row.actorEmail || "System Automation"}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-normal">
            Role: {row.actorRole || "system"}
          </div>
        </div>
      ),
    },
    {
      header: "Target Entity",
      key: "targetType",
      render: (val, row) => (
        <div>
          <div className="font-semibold text-slate-800 text-xs">
            {val || "Global Platform"}
          </div>
          <div className="text-[11px] text-slate-500 font-normal">
            ID: {row.targetId || "N/A"}
          </div>
        </div>
      ),
    },
    {
      header: "Payload Inspector",
      key: "metadata",
      sortable: false,
      render: (val) => (
        <button
          onClick={() => setSelectedPayload(val || { status: "success" })}
          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <FileCode className="w-3.5 h-3.5 text-indigo-600" />
          <span>Inspect JSON</span>
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <OpsHeader
        title="Security Audit Trail"
        subtitle="Immutable log stream of security events, administrative mutations, and cross-tenant actions"
        onRefresh={fetchAuditLogs}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <span>{error}</span>
            <button onClick={() => setError("")} className="hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span className="font-semibold text-slate-700">
                Actor Role:
              </span>
              <select
                value={actorRoleFilter}
                onChange={(e) => setActorRoleFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
              >
                <option value="all">All Roles</option>
                <option value="super-admin">Super Admin</option>
                <option value="college-admin">College Admin</option>
                <option value="student">Student</option>
                <option value="system">System Automation</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">
                Event Category:
              </span>
              <select
                value={actionCategoryFilter}
                onChange={(e) => setActionCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
              >
                <option value="all">All Categories</option>
                <option value="auth">Auth & Sessions</option>
                <option value="tenant">Tenant Onboarding</option>
                <option value="security">Security Alerts</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Loaded <strong className="text-slate-900">{filteredLogs.length}</strong> events
            </span>
            <button
              onClick={() =>
                exportToCSV(
                  filteredLogs,
                  `audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
                )
              }
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Dense Audit Data Table */}
        <OpsDataTable
          columns={columns}
          data={filteredLogs}
          isLoading={isLoading}
          searchPlaceholder="Filter audit records by action, IP address, actor ID..."
          emptyMessage="Zero security audit events match current filter conditions."
        />

        {/* JSON Payload Inspector Modal */}
        {selectedPayload && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-2xl w-full space-y-4 shadow-2xl font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-bold text-white uppercase">
                    Audit Log Payload Inspector
                  </span>
                </div>
                <button
                  onClick={() => setSelectedPayload(null)}
                  className="text-slate-500 hover:text-slate-300 text-xs font-bold"
                >
                  CLOSE
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-800 max-h-96 overflow-y-auto">
                <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(selectedPayload, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedPayload(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs"
                >
                  DISMISS INSPECTOR
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
