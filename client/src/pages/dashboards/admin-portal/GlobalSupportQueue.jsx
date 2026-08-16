import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  MessageSquare,
  Filter,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";

export default function GlobalSupportQueue() {
  const [complaints, setComplaints] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Filters State
  const [collegeFilter, setCollegeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Response Modal State
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [adminResponseText, setAdminResponseText] = useState("");
  const [targetStatus, setTargetStatus] = useState("resolved");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComplaints = useCallback(() => setReloadToken((t) => t + 1), []);

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
    async function loadComplaints() {
      try {
        setIsLoading(true);
        const res = await adminApi.getGlobalComplaints({
          collegeId: collegeFilter || undefined,
          status: statusFilter || undefined,
        });
        if (isMounted) setComplaints(res.data || []);
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setMessage({
            type: "error",
            text:
              err.response?.data?.message ||
              "Failed to load support complaint tickets.",
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadComplaints();
    return () => {
      isMounted = false;
    };
  }, [reloadToken, collegeFilter, statusFilter]);

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    setIsSubmitting(true);
    try {
      await adminApi.updateComplaintStatus(selectedComplaint._id, {
        status: targetStatus,
        adminResponse: adminResponseText.trim(),
      });

      setMessage({
        type: "success",
        text: `Support ticket status updated to ${targetStatus}.`,
      });
      setSelectedComplaint(null);
      setAdminResponseText("");
      fetchComplaints();
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message || "Failed to update complaint ticket.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <OpsHeader
        title="Helpdesk & Support Escalations"
        subtitle="Centralized support management queue for technical support tickets, patron inquiries, and system complaints"
        onRefresh={fetchComplaints}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notification Banner */}
        {message.text && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-xs ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage({ type: "", text: "" })}
              className="font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600" /> Filter Support
              Queue ({complaints.length})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium">
            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
            >
              <option value="">All Institutions</option>
              {colleges.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
            >
              <option value="">All Ticket Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Complaints Grid */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs font-medium animate-pulse">
            Fetching cross-tenant complaint queue...
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-16 text-center bg-white border border-slate-200/80 rounded-2xl p-8 shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900">
              Zero Unresolved Escalated Tickets
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              All patron complaints have been handled or no records match the
              active filter criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {complaints.map((c) => {
              const isRes = c.status === "resolved";
              return (
                <div
                  key={c._id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs hover:border-indigo-200 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <OpsSeverityBadge
                          status={
                            isRes
                              ? "healthy"
                              : c.status === "in_progress"
                                ? "info"
                                : "warning"
                          }
                          label={
                            c.status
                              ? c.status.replace("_", " ").toUpperCase()
                              : "OPEN"
                          }
                          size="sm"
                        />
                        <span className="text-xs font-semibold text-indigo-600">
                          {c.collegeId?.name
                            ? `${c.collegeId.name} (${c.collegeId.code})`
                            : "Global Tenant"}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {c.subject || c.category || "Patron Support Ticket"}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-normal flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedComplaint(c);
                          setAdminResponseText(c.adminResponse || "");
                          setTargetStatus(
                            c.status === "resolved" ? "resolved" : "resolved",
                          );
                        }}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs"
                      >
                        Respond & Resolve
                      </button>
                    </div>
                  </div>

                  {/* Complaint Details */}
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-700 leading-relaxed font-normal">
                      {c.description || c.details || "No details provided."}
                    </p>
                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                      <span>
                        User ID: {c.userId?.name || c.userId || "Patron"}
                      </span>
                      <span>·</span>
                      <span>Category: {c.category || "General"}</span>
                    </div>
                  </div>

                  {/* Admin Response Snippet if any */}
                  {c.adminResponse && (
                    <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl text-xs space-y-1">
                      <span className="font-semibold text-indigo-800 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                        Admin Resolution Note:
                      </span>
                      <p className="text-indigo-900 leading-relaxed">
                        {c.adminResponse}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Response Modal */}
        {selectedComplaint && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  Update Support Ticket Resolution
                </h3>
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Close
                </button>
              </div>

              <form
                onSubmit={handleResponseSubmit}
                className="space-y-4 text-xs font-medium"
              >
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Set Resolution Status
                  </label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Administrator Response / Resolution Details
                  </label>
                  <textarea
                    rows={4}
                    value={adminResponseText}
                    onChange={(e) => setAdminResponseText(e.target.value)}
                    placeholder="Enter official resolution notes for the patron..."
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:border-indigo-500 focus:outline-none shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedComplaint(null)}
                    className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Resolution</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
