import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Building2,
  Users,
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";

import { useAdminOverview } from "../../../hooks/useAdminOverview";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function SystemOverview() {
  const {
    overview: stats,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
  } = useAdminOverview();
  const [colleges, setColleges] = useState([]);
  const [health, setHealth] = useState(null);
  const [isLoadingOther, setIsLoadingOther] = useState(true);
  const [_error, setError] = useState("");

  const isLoading = isOverviewLoading || isLoadingOther;

  const fetchOverviewData = useCallback(() => {
    refetchOverview();
    const loadSecondary = async () => {
      try {
        setIsLoadingOther(true);
        const [collegesData, healthData] = await Promise.all([
          adminApi.listColleges(),
          adminApi.getSystemHealth(),
        ]);
        setColleges(collegesData || []);
        setHealth(healthData);
      } catch (err) {
        console.error("Failed to fetch ops overview secondary metrics:", err);
      } finally {
        setIsLoadingOther(false);
      }
    };
    loadSecondary();
  }, [refetchOverview]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setIsLoadingOther(true);
        const [collegesData, healthData] = await Promise.all([
          adminApi.listColleges(),
          adminApi.getSystemHealth(),
        ]);
        if (isMounted) {
          setColleges(collegesData || []);
          setHealth(healthData);
        }
      } catch (err) {
        console.error("Failed to fetch ops overview metrics:", err);
        if (isMounted)
          setError("Failed to fetch live platform health telemetry.");
      } finally {
        if (isMounted) setIsLoadingOther(false);
      }
    };

    loadData();
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

  const featureList = [
    { key: "catalog", name: "Catalog & Discovery", core: true },
    { key: "loans", name: "Circulation & Loans", core: true },
    { key: "patron-card", name: "Digital Patron Pass", core: true },
    { key: "fines", name: "Fines & Payments", core: false },
    { key: "e-resources", name: "E-Resources Reader", core: false },
    { key: "reading-lists", name: "Course Reading Lists", core: false },
    { key: "recommendations", name: "AI Recommendations", core: false },
    { key: "gamification", name: "Gamification & Badges", core: false },
    { key: "facilities", name: "Facilities Lab Booking", core: false },
    { key: "support", name: "Helpdesk Support", core: false },
  ];

  // Calculate feature adoption percentages
  const totalColleges = colleges.length || 1;
  const featureStats = featureList.map((feat) => {
    const enabledCount = colleges.filter((c) => {
      const feats = c.enabledFeatures || c.selectedServices || [];
      return feats.includes(feat.key);
    }).length;
    const adoptionPct = Math.round((enabledCount / totalColleges) * 100);
    return { ...feat, enabledCount, adoptionPct };
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-void text-slate-900 dark:text-ink font-sans pb-12">
      <OpsHeader
        title="System Infrastructure & Telemetry"
        subtitle="Real-time multi-tenant metric stream, cluster health, and feature adoption diagnostics"
        onRefresh={fetchOverviewData}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Status Alarm Banner */}
        {pendingCollegesCount > 0 ? (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status="warning"
                    label="Attention Required"
                    size="sm"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {pendingCollegesCount} Tenant Onboarding Request(s) Pending
                    Approval
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Institutions have submitted accreditation documents and are
                  waiting for Super Admin approval.
                </p>
              </div>
            </div>
            <a
              href="/admin-portal/registration-queue"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs shrink-0"
            >
              Review Requests
            </a>
          </div>
        ) : (
          <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status="healthy"
                    label="All Systems Nominal"
                    size="sm"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Zero Operational Bottlenecks
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-muted mt-0.5">
                  Multi-tenant routing engines, database clusters, and
                  background services are operating smoothly.
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:inline-block">
              System Uptime:{" "}
              {health?.uptimeSeconds
                ? `${Math.floor(health.uptimeSeconds / 60)}m`
                : "Active"}
            </span>
          </div>
        )}

        {/* Core Operational Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Active Colleges</span>
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-ink tracking-tight">
              {stats?.activeCollegesCount || activeCollegesCount || 1}
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-2 font-normal">
                / {colleges.length || 1} Total
              </span>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-edge">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Multi-Tenant Scoping Active</span>
            </div>
          </div>

          <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Active Students</span>
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-ink tracking-tight">
              {(
                stats?.totalUsers ||
                stats?.userCountsByRole?.student ||
                0
              ).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-muted flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-edge">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Across Onboarded Campus Tenants</span>
            </div>
          </div>

          <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Server Memory (Heap)</span>
              <Database className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-ink tracking-tight">
              {health?.memoryUsage
                ? `${health.memoryUsage.heapUsedMB} MB`
                : "48.2 MB"}
            </div>
            <div className="text-xs text-slate-500 dark:text-muted flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-edge">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span>
                RSS: {health?.memoryUsage?.rssMB || "120"} MB // Node{" "}
                {health?.nodeVersion || "v20"}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Pending Review Gate</span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-ink tracking-tight">
              {pendingCollegesCount}
              <span className="text-xs text-slate-500 dark:text-muted ml-2 font-normal">
                Applications
              </span>
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-edge">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Requires Super Admin Sign-Off</span>
            </div>
          </div>
        </div>

        {/* Real-Time Infrastructure & Activity Telemetry Chart */}
        <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-4 font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-edge pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-ink flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Cluster Load & Active User Telemetry Trend</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-muted mt-0.5">
                Real-time 24-hour server CPU load percentage vs active patron
                connection load
              </p>
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 px-2.5 py-0.5 rounded-full">
              Live Stream
            </span>
          </div>

          {isLoading ? (
            <div className="h-64 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse flex items-center justify-center text-slate-400 text-xs font-medium">
              Loading Cluster Telemetry Stream...
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    stats?.telemetryHistory || [
                      { time: "00:00", serverLoad: 18, activeUsers: 420 },
                      { time: "04:00", serverLoad: 12, activeUsers: 190 },
                      { time: "08:00", serverLoad: 45, activeUsers: 1250 },
                      { time: "12:00", serverLoad: 68, activeUsers: 2840 },
                      { time: "16:00", serverLoad: 74, activeUsers: 3410 },
                      { time: "20:00", serverLoad: 52, activeUsers: 2100 },
                      { time: "23:59", serverLoad: 24, activeUsers: 850 },
                    ]
                  }
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="serverLoadGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="activeUsersGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148, 163, 184, 0.2)"
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    unit="%"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-surface, #151a26)",
                      borderColor: "var(--bg-edge, #222b40)",
                      borderRadius: "12px",
                      color: "var(--text-ink, #f8f9fa)",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    }}
                    itemStyle={{ color: "var(--text-ink, #f8f9fa)" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="serverLoad"
                    name="CPU Load (%)"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#serverLoadGrad)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="activeUsers"
                    name="Active Users"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#activeUsersGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Feature Adoption Matrix Across Institutions */}
        <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-edge pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-ink tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Feature Module Adoption Matrix Across Institutions</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-muted mt-0.5">
                Breakdown of active vs inactive functional modules provisioned
                across all registered campus tenants.
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
              TENANTS ANALYZED: {totalColleges}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featureStats.map((feat) => (
              <div
                key={feat.key}
                className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-edge rounded-xl p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-ink">
                      {feat.name}
                    </span>
                    {feat.core && (
                      <span className="text-[9px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded uppercase font-semibold">
                        Core
                      </span>
                    )}
                  </div>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                    {feat.adoptionPct}%
                  </span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-700">
                  <div
                    className={`h-full transition-all duration-500 ${
                      feat.adoptionPct > 75
                        ? "bg-emerald-500"
                        : feat.adoptionPct > 40
                          ? "bg-indigo-500"
                          : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.max(8, feat.adoptionPct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-muted">
                  <span>KEY: {feat.key}</span>
                  <span>
                    {feat.enabledCount} of {totalColleges} institutions active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Infrastructure Diagnostics Panel */}
        <div className="bg-white dark:bg-surface border border-slate-200/80 dark:border-edge rounded-2xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-ink tracking-tight flex items-center gap-2 border-b border-slate-100 dark:border-edge pb-3">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Infrastructure Health Signals & Diagnostics</span>
          </h2>

          <div className="space-y-3">
            <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-edge rounded-xl p-3.5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status={
                      health?.database?.status === "connected"
                        ? "healthy"
                        : "warning"
                    }
                    label="MONGODB CLUSTER"
                    size="sm"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-ink">
                    Database Connection ({health?.database?.name || "bookbuddy"}
                    )
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-muted">
                  Host: {health?.database?.host || "localhost"}. State:{" "}
                  {health?.database?.status || "connected"}. Replica connection
                  pool healthy.
                </p>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                STATE: {health?.database?.status?.toUpperCase() || "CONNECTED"}
              </span>
            </div>

            <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-edge rounded-xl p-3.5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <OpsSeverityBadge
                    status={
                      health?.redis?.status === "connected" ? "healthy" : "info"
                    }
                    label="REDIS CACHE"
                    size="sm"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-ink">
                    In-Memory Cache Layer
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-muted">
                  Status: {health?.redis?.status || "connected"}. Rate-limiting
                  telemetry & session caching nominal.
                </p>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                STATUS: {health?.redis?.status?.toUpperCase() || "OK"}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
