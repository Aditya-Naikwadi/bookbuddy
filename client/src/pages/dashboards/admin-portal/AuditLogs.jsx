import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Building2,
  Terminal,
  FileCode,
  Eye,
  Download,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";
import OpsDataTable from "../../../components/ops/OpsDataTable";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPayload, setSelectedPayload] = useState(null);

  // Advanced Filters
  const [actorRoleFilter, setActorRoleFilter] = useState("all");
  const [actionCategoryFilter, setActionCategoryFilter] = useState("all");

  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await adminApi.getAuditLogs();
      setLogs(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch security audit logs.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Filter logs by actor role & action category
  const filteredLogs = logs.filter((log) => {
    if (actorRoleFilter !== "all" && log.actorRole !== actorRoleFilter) return false;
    if (actionCategoryFilter !== "all") {
      const action = (log.action || "").toLowerCase();
      if (actionCategoryFilter === "auth" && !action.includes("auth") && !action.includes("login")) return false;
      if (actionCategoryFilter === "tenant" && !action.includes("tenant") && !action.includes("registration") && !action.includes("college")) return false;
      if (actionCategoryFilter === "security" && !action.includes("security") && !action.includes("mfa") && !action.includes("forbidden")) return false;
    }
    return true;
  });

  const getActionSeverity = (action = "") => {
    const act = action.toLowerCase();
    if (act.includes("reject") || act.includes("forbidden") || act.includes("failed") || act.includes("delete")) return "critical";
    if (act.includes("approve") || act.includes("create") || act.includes("submit") || act.includes("onboarding")) return "warning";
    if (act.includes("login") || act.includes("verify") || act.includes("auth")) return "healthy";
    return "info";
  };

  const columns = [
    {
      header: "Timestamp (UTC)",
      key: "createdAt",
      render: (val) => {
        const dateStr = val
          ? new Date(val).toISOString().replace("T", " ").substring(0, 19)
          : "2026-07-26 12:00:00";
        return <span className="font-mono text-slate-300 text-xs">{dateStr}</span>;
      },
    },
    {
      header: "Event Severity",
      key: "action",
      render: (val) => <OpsSeverityBadge status={getActionSeverity(val)} size="sm" />,
    },
    {
      header: "Actor Identity",
      key: "actorRole",
      render: (val, row) => (
        <div>
          <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            <span>{row.actorId || "SYSTEM_PROCESS"}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Role: <strong className="text-indigo-300 uppercase">{val || "system"}</strong> | IP: {row.ipAddress || "127.0.0.1"}
          </div>
        </div>
      ),
    },
    {
      header: "Mutation / Event Code",
      key: "action",
      render: (val) => (
        <span className="font-mono font-bold text-xs text-white bg-slate-950 px-2 py-1 rounded border border-slate-800">
          {val || "SYSTEM_EVENT"}
        </span>
      ),
    },
    {
      header: "Target Resource",
      key: "targetType",
      render: (val, row) => (
        <div className="text-xs">
          <span className="text-slate-400 font-bold uppercase">{val || "GLOBAL"}</span>
          <div className="text-[10px] text-slate-500 font-mono">ID: {row.targetId || "N/A"}</div>
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
          className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors"
        >
          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
          <span>INSPECT JSON</span>
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <OpsHeader
        title="MODULE 04 // CENTRALIZED SECURITY AUDIT LOG VIEWER"
        subtitle="Read-only immutable log stream of security events, administrative mutations, and cross-tenant actions"
        onRefresh={fetchAuditLogs}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6 font-mono">
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-950/60 border border-rose-700/60 p-3 rounded-lg text-rose-300 text-xs font-bold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="hover:underline">
              DISMISS
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-slate-300 uppercase">Actor Role:</span>
              <select
                value={actorRoleFilter}
                onChange={(e) => setActorRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">ALL ROLES</option>
                <option value="super-admin">SUPER ADMIN</option>
                <option value="college-admin">COLLEGE ADMIN</option>
                <option value="student">STUDENT</option>
                <option value="system">SYSTEM</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300 uppercase">Event Category:</span>
              <select
                value={actionCategoryFilter}
                onChange={(e) => setActionCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">ALL CATEGORIES</option>
                <option value="auth">AUTH & SESSIONS</option>
                <option value="tenant">TENANT ONBOARDING</option>
                <option value="security">SECURITY ALERTS</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-bold">
            AUDIT STREAM: <strong className="text-indigo-400">{filteredLogs.length}</strong> EVENTS LOADED
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
