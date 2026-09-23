import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  Search,
  X,
  BookOpen,
  Receipt,
  Users,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";
import apiClient from "../../../api/client";
import { toast } from "../../../store/toastStore";
import { rejectStudentJoinRequestBodySchema } from "@shared/schemas/joinRequests";

const EMPTY_ARRAY = [];

export default function PatronsDesk() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: "roster" vs "join-requests"
  const activeTab =
    searchParams.get("tab") === "join-requests" ? "join-requests" : "roster";
  const setActiveTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "join-requests") {
        next.set("tab", "join-requests");
      } else {
        next.delete("tab");
      }
      return next;
    });
  };

  // Enrolled Patrons states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatronId, setSelectedPatronId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form states (Add Patron Modal)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState("");
  const [studentId, setStudentId] = useState("");

  // Student Join Requests states
  const [joinRequestsSearch, setJoinRequestsSearch] = useState("");
  const [joinRequestsStatus, setJoinRequestsStatus] = useState("pending");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRejectRequest, setSelectedRejectRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionReasonError, setRejectionReasonError] = useState("");

  // Queries: Enrolled Patrons
  const { data: patronsData, isLoading } = useQuery({
    queryKey: ["allPatrons"],
    queryFn: () => collegeAdminApi.getAllPatrons(),
  });

  const { data: patronDetailData, isLoading: isDetailLoading } = useQuery({
    queryKey: ["patronDetail", selectedPatronId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/dashboards/college-admin/patrons/${selectedPatronId}`,
      );
      return res.data;
    },
    enabled: !!selectedPatronId,
  });

  // Queries: Student Join Requests
  const {
    data: joinRequestsData,
    isLoading: isJoinRequestsLoading,
    isFetching: isJoinRequestsFetching,
    refetch: refetchJoinRequests,
  } = useQuery({
    queryKey: ["studentJoinRequests", joinRequestsStatus, joinRequestsSearch],
    queryFn: () =>
      collegeAdminApi.getStudentJoinRequests({
        status: joinRequestsStatus === "all" ? undefined : joinRequestsStatus,
        search: joinRequestsSearch.trim() || undefined,
      }),
  });

  // Pending count query for tab badge
  const { data: pendingCountData } = useQuery({
    queryKey: ["studentJoinRequestsPendingCount"],
    queryFn: () =>
      collegeAdminApi.getStudentJoinRequests({ status: "pending", limit: 1 }),
    refetchInterval: 30000,
  });
  const pendingRequestsCount = pendingCountData?.pagination?.total ?? 0;

  // Mutations
  const createPatronMutation = useMutation({
    mutationFn: (payload) => collegeAdminApi.createStudentPatron(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allPatrons"] });
      setIsModalOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setDepartment("");
      setStudentId("");
      toast.success(
        "Patron Enrolled",
        "Student patron account created successfully.",
      );
    },
    onError: (err) => {
      toast.error(
        "Enrollment Failed",
        err?.response?.data?.message || "Could not enroll student.",
      );
    },
  });

  const approveJoinRequestMutation = useMutation({
    mutationFn: (id) => collegeAdminApi.approveStudentJoinRequest(id),
    onSuccess: (res) => {
      const studentName = res?.data?.user?.name || "Student";
      toast.success(
        "Join Request Approved",
        `${studentName} has been approved and activated with full campus access.`,
      );
      queryClient.invalidateQueries({ queryKey: ["studentJoinRequests"] });
      queryClient.invalidateQueries({
        queryKey: ["studentJoinRequestsPendingCount"],
      });
      queryClient.invalidateQueries({ queryKey: ["allPatrons"] });
    },
    onError: (err) => {
      toast.error(
        "Approval Failed",
        err?.response?.data?.message ||
          "Could not approve student join request.",
      );
    },
  });

  const rejectJoinRequestMutation = useMutation({
    mutationFn: ({ id, reason }) => {
      const payload = rejectStudentJoinRequestBodySchema.parse({ reason });
      return collegeAdminApi.rejectStudentJoinRequest(id, payload);
    },
    onSuccess: () => {
      toast.success(
        "Join Request Rejected",
        "Student join request has been rejected.",
      );
      queryClient.invalidateQueries({ queryKey: ["studentJoinRequests"] });
      queryClient.invalidateQueries({
        queryKey: ["studentJoinRequestsPendingCount"],
      });
      setRejectModalOpen(false);
      setSelectedRejectRequest(null);
      setRejectionReason("");
      setRejectionReasonError("");
    },
    onError: (err) => {
      toast.error(
        "Rejection Failed",
        err?.response?.data?.message || "Could not reject student join request.",
      );
    },
  });

  const patrons = patronsData?.data || EMPTY_ARRAY;
  const joinRequests = joinRequestsData?.data || EMPTY_ARRAY;

  const filteredPatrons = useMemo(() => {
    return patrons.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.studentId?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && p.isActive !== false) ||
        (statusFilter === "inactive" && p.isActive === false);

      return matchesSearch && matchesStatus;
    });
  }, [patrons, searchQuery, statusFilter]);

  const patronDetail = patronDetailData?.data || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
            ILS MODULE 04 — PATRON & MEMBER MANAGEMENT
          </span>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Student & Faculty Membership Desk
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage enrolled campus patrons, review self-registration join
            requests, and track individual borrowing standing.
          </p>
        </div>

        {activeTab === "roster" && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs text-white shadow-lg shadow-indigo-600/20 transition-colors shrink-0"
          >
            <UserPlus size={16} /> Add Individual Student Patron
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          id="tab-enrolled-patrons"
          onClick={() => setActiveTab("roster")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all ${
            activeTab === "roster"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
          }`}
        >
          <Users size={16} />
          <span>Enrolled Patrons Roster</span>
          <span className="ml-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950/80 text-indigo-300 border border-indigo-500/20">
            {patrons.length}
          </span>
        </button>

        <button
          id="tab-join-requests"
          onClick={() => setActiveTab("join-requests")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all relative ${
            activeTab === "join-requests"
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25"
              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
          }`}
        >
          <UserCheck size={16} />
          <span>Student Join Requests</span>
          {pendingRequestsCount > 0 ? (
            <span className="ml-1.5 text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-sm animate-pulse">
              {pendingRequestsCount} PENDING
            </span>
          ) : (
            <span className="ml-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950/80 text-slate-500">
              0
            </span>
          )}
        </button>
      </div>

      {/* TAB CONTENT: ENROLLED PATRONS ROSTER */}
      {activeTab === "roster" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Stats Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Total Patrons
              </div>
              <div className="text-2xl font-mono font-extrabold text-white mt-1">
                {patrons.length}
              </div>
              <div className="text-[10px] text-indigo-400 mt-0.5">
                Enrolled Accounts
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Active Status
              </div>
              <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">
                {patrons.filter((p) => p.isActive !== false).length}
              </div>
              <div className="text-[10px] text-emerald-400/80 mt-0.5">
                Good Standing
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Filtered View
              </div>
              <div className="text-2xl font-mono font-extrabold text-cyan-400 mt-1">
                {filteredPatrons.length}
              </div>
              <div className="text-[10px] text-cyan-400/80 mt-0.5">
                Matching Criteria
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Departments
              </div>
              <div className="text-2xl font-mono font-extrabold text-purple-400 mt-1">
                {new Set(patrons.map((p) => p.department || "General")).size}
              </div>
              <div className="text-[10px] text-purple-400/80 mt-0.5">
                Academic Units
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search patron by name, email, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {["all", "active", "inactive"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-indigo-400" size={20} />{" "}
              Loading patrons roster...
            </div>
          ) : filteredPatrons.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              No registered patrons found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Name</th>
                    <th className="p-3.5">Student / Card ID</th>
                    <th className="p-3.5">Campus Email</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {filteredPatrons.map((patron) => (
                    <tr key={patron._id} className="hover:bg-slate-800/30">
                      <td className="p-3.5 font-bold text-white">
                        {patron.name}
                      </td>
                      <td className="p-3.5 font-mono text-indigo-300">
                        {patron.studentId || "—"}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {patron.email}
                      </td>
                      <td className="p-3.5">
                        {patron.department || patron.major || "General"}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            patron.isActive !== false
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {patron.isActive !== false
                            ? "Active Member"
                            : "Suspended"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedPatronId(patron._id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: STUDENT JOIN REQUESTS */}
      {activeTab === "join-requests" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Join Requests Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Pending Approval
              </div>
              <div className="text-2xl font-mono font-extrabold text-amber-400 mt-1">
                {pendingRequestsCount}
              </div>
              <div className="text-[10px] text-amber-400/80 mt-0.5">
                Require Verification
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Filtered Requests
              </div>
              <div className="text-2xl font-mono font-extrabold text-white mt-1">
                {joinRequests.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Current View
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Current Status Filter
              </div>
              <div className="text-2xl font-mono font-extrabold text-cyan-400 mt-1 uppercase">
                {joinRequestsStatus}
              </div>
              <div className="text-[10px] text-cyan-400/80 mt-0.5">
                Application State
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Auto-Activation
              </div>
              <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">
                Active
              </div>
              <div className="text-[10px] text-emerald-400/80 mt-0.5">
                Instant Provisioning
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter requests by name, email, ID..."
                value={joinRequestsSearch}
                onChange={(e) => setJoinRequestsSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                {["pending", "approved", "rejected", "all"].map((st) => (
                  <button
                    key={st}
                    data-testid={`filter-requests-${st}`}
                    onClick={() => setJoinRequestsStatus(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold capitalize transition-colors ${
                      joinRequestsStatus === st
                        ? st === "pending"
                          ? "bg-amber-600 text-white"
                          : st === "approved"
                            ? "bg-emerald-600 text-white"
                            : st === "rejected"
                              ? "bg-rose-600 text-white"
                              : "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <button
                data-testid="refresh-requests-btn"
                onClick={() => refetchJoinRequests()}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                title="Refresh requests"
              >
                <RotateCw
                  size={16}
                  className={isJoinRequestsFetching ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>

          {/* Table of Join Requests */}
          {isJoinRequestsLoading ? (
            <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-amber-400" size={20} />{" "}
              Loading student join requests...
            </div>
          ) : joinRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
              <UserCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-bold">No student join requests found.</p>
              <p className="text-xs mt-1 text-slate-500">
                {joinRequestsStatus === "pending"
                  ? "All pending student join requests have been resolved."
                  : `No requests with status: "${joinRequestsStatus}".`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Student Name</th>
                    <th className="p-3.5">Student ID</th>
                    <th className="p-3.5">Campus Email</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Date Submitted</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {joinRequests.map((req) => (
                    <tr key={req._id} className="hover:bg-slate-800/30">
                      <td className="p-3.5">
                        <div className="font-bold text-white">{req.name}</div>
                        {req.phone && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {req.phone}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-amber-300 font-bold">
                        {req.studentId}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {req.email}
                      </td>
                      <td className="p-3.5">{req.department || "General"}</td>
                      <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                        {new Date(
                          req.submittedAt || req.createdAt,
                        ).toLocaleDateString()}{" "}
                        <span className="text-slate-500 text-[10px]">
                          {new Date(
                            req.submittedAt || req.createdAt,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {req.status === "pending" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock size={12} className="animate-spin" />
                            Pending Review
                          </span>
                        )}
                        {req.status === "approved" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={12} />
                            Approved
                          </span>
                        )}
                        {req.status === "rejected" && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle size={12} />
                              Rejected
                            </span>
                            {req.rejectionReason && (
                              <div className="text-[10px] text-rose-300/80 italic max-w-xs truncate">
                                Reason: {req.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {req.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              data-testid={`approve-request-btn-${req._id}`}
                              onClick={() =>
                                approveJoinRequestMutation.mutate(req._id)
                              }
                              disabled={approveJoinRequestMutation.isPending}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                              {approveJoinRequestMutation.isPending &&
                              approveJoinRequestMutation.variables ===
                                req._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                              <span>Approve</span>
                            </button>

                            <button
                              data-testid={`reject-request-btn-${req._id}`}
                              onClick={() => {
                                setSelectedRejectRequest(req);
                                setRejectionReason("");
                                setRejectionReasonError("");
                                setRejectModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1 transition-colors"
                            >
                              <XCircle size={14} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : req.status === "approved" ? (
                          <span className="text-[11px] font-mono text-emerald-400/80">
                            Activated
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-rose-400/80">
                            Dismissed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reject Join Request Modal */}
      {rejectModalOpen && selectedRejectRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle size={20} />
                <h3 className="text-lg font-bold text-white">
                  Reject Student Join Request
                </h3>
              </div>
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setSelectedRejectRequest(null);
                  setRejectionReason("");
                  setRejectionReasonError("");
                }}
                className="text-slate-400 hover:text-white p-1 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-white text-sm">
                {selectedRejectRequest.name}
              </div>
              <div className="text-slate-400 font-mono">
                {selectedRejectRequest.email}
              </div>
              <div className="text-slate-400">
                Student ID:{" "}
                <span className="font-mono text-indigo-300">
                  {selectedRejectRequest.studentId}
                </span>
              </div>
            </div>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!rejectionReason.trim()) {
                  setRejectionReasonError(
                    "Rejection reason is required before rejecting.",
                  );
                  return;
                }
                rejectJoinRequestMutation.mutate({
                  id: selectedRejectRequest._id,
                  reason: rejectionReason.trim(),
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Reason for Rejection <span className="text-rose-400">*</span>
                </label>
                <textarea
                  data-testid="reject-reason-textarea"
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionReasonError) setRejectionReasonError("");
                  }}
                  placeholder="Explain why this student application cannot be approved..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
                {rejectionReasonError && (
                  <p className="text-rose-400 text-xs mt-1 font-medium flex items-center gap-1">
                    <FileText size={12} /> {rejectionReasonError}
                  </p>
                )}
              </div>

              {/* Quick Reason Template Chips */}
              <div>
                <span className="text-[11px] font-mono text-slate-500 uppercase block mb-1.5">
                  Suggested Reason Templates:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Not found on official registrar roster",
                    "Invalid student ID format",
                    "Duplicate application submitted",
                    "Department mismatch with campus records",
                  ].map((chip, index) => (
                    <button
                      type="button"
                      key={chip}
                      data-testid={`quick-reason-chip-${index}`}
                      onClick={() => {
                        setRejectionReason(chip);
                        setRejectionReasonError("");
                      }}
                      className="text-[10px] bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-lg px-2.5 py-1 transition-colors text-left"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  data-testid="cancel-reject-btn"
                  onClick={() => {
                    setRejectModalOpen(false);
                    setSelectedRejectRequest(null);
                    setRejectionReason("");
                    setRejectionReasonError("");
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="confirm-reject-btn"
                  disabled={rejectJoinRequestMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  {rejectJoinRequestMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                      Rejecting...
                    </>
                  ) : (
                    "Reject Application"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patron Details Modal */}
      {selectedPatronId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Patron Membership Profile
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  ID: {selectedPatronId}
                </p>
              </div>
              <button
                onClick={() => setSelectedPatronId(null)}
                className="text-slate-400 hover:text-white p-1 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {isDetailLoading ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                <p className="text-xs mt-2">Loading member record...</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl space-y-1">
                  <div className="font-bold text-base text-white">
                    {patronDetail.name}
                  </div>
                  <div className="text-slate-400 font-mono">
                    {patronDetail.email}
                  </div>
                  <div className="text-slate-400">
                    Student ID:{" "}
                    <span className="font-mono text-indigo-300">
                      {patronDetail.studentId || "N/A"}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-mono font-bold text-slate-300 uppercase mb-2 flex items-center gap-1.5">
                    <BookOpen size={14} className="text-indigo-400" />
                    <span>Active Borrowing History</span>
                  </h4>
                  {patronDetail.loans?.length === 0 ? (
                    <p className="text-slate-500 italic">
                      No current books checked out.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {patronDetail.loans?.map((loan) => (
                        <div
                          key={loan._id}
                          className="p-2 bg-slate-950 rounded-lg flex justify-between items-center"
                        >
                          <span className="font-bold text-slate-200 truncate max-w-[200px]">
                            {loan.bookId?.title || "Book"}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            Due: {new Date(loan.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-mono font-bold text-slate-300 uppercase mb-2 flex items-center gap-1.5">
                    <Receipt size={14} className="text-rose-400" />
                    <span>Outstanding Fines</span>
                  </h4>
                  {patronDetail.fines?.length === 0 ? (
                    <p className="text-emerald-400 text-xs">
                      No pending fines. Account in good standing.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {patronDetail.fines?.map((fine) => (
                        <div
                          key={fine._id}
                          className="p-2 bg-slate-950 rounded-lg flex justify-between items-center"
                        >
                          <span className="text-slate-300">
                            {fine.reason || "Late return fine"}
                          </span>
                          <span className="font-mono font-bold text-rose-400">
                            ₹{fine.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Patron Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-white">
              Enroll New Student Patron
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPatronMutation.mutate({
                  name,
                  email,
                  password,
                  studentId,
                  department,
                  role: "student",
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Student ID Number *
                </label>
                <input
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. STU-2026-089"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Campus Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Initial Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 pr-9 text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-mono font-bold text-slate-400 uppercase mb-1">
                  Department / Academic Major
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPatronMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {createPatronMutation.isPending
                    ? "Enrolling..."
                    : "Enroll Patron"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
