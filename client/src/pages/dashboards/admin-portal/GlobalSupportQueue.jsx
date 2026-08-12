import React, { useState, useEffect, useCallback } from "react";
import {
  HelpCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  MessageSquare,
  Building,
  RefreshCw,
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
            text: err.response?.data?.message || "Failed to load support complaint tickets.",
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
        text: err.response?.data?.message || "Failed to update complaint ticket.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <OpsHeader
        title="MODULE 05 // GLOBAL SUPPORT & COMPLAINT RESOLUTION QUEUE"
        subtitle="Review, triage, and resolve escalated patron tickets and helpdesk complaints across all institution tenants"
        onRefresh={fetchComplaints}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notification Banner */}
        {message.text && (
          <div
            className={`p-3 rounded-lg font-mono text-xs flex items-center justify-between border ${
              message.type === "success"
                ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                : "bg-rose-950/60 border-rose-700/60 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage({ type: "", text: "" })}
              className="font-bold hover:underline"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-400" /> Filter Support Queue ({complaints.length})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-indigo-500 focus:outline-none"
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
          <div className="py-12 text-center text-slate-400 font-mono text-xs animate-pulse">
            Fetching cross-tenant complaint queue...
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-xl p-8 font-mono">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white uppercase">
              Zero Unresolved Escalated Tickets
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              All patron complaints have been handled or no records match the active filter criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 font-mono">
            {complaints.map((c) => {
              const isRes = c.status === "resolved";
              return (
                <div
                  key={c._id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <OpsSeverityBadge
                          status={isRes ? "healthy" : c.status === "in_progress" ? "info" : "warning"}
                          label={(c.status || "open").toUpperCase()}
                          size="sm"
                        />
                        <span className="text-xs font-bold text-indigo-300">
                          {c.collegeId?.name ? `${c.collegeId.name} (${c.collegeId.code})` : "Global Tenant"}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{c.subject || c.category || "Patron Complaint"}</h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedComplaint(c);
                          setAdminResponseText(c.adminResponse || "");
                          setTargetStatus(c.status === "resolved" ? "resolved" : "resolved");
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all"
                      >
                        RESPOND / UPDATE
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                        Patron Description ({c.submittedBy?.name || c.userId?.name || "Anonymous User"})
                      </div>

                      <p className="whitespace-pre-wrap">{c.description || c.message || "No text provided."}</p>
                    </div>

                    {c.adminResponse && (
                      <div className="text-indigo-200 bg-indigo-950/40 p-3 rounded-lg border border-indigo-700/50 space-y-1">
                        <div className="text-[10px] text-indigo-400 uppercase font-bold flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" /> Admin Official Response
                        </div>
                        <p className="whitespace-pre-wrap">{c.adminResponse}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RESPONSE MODAL */}
        {selectedComplaint && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
            <form
              onSubmit={handleResponseSubmit}
              className="bg-slate-900 border border-indigo-600/60 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                UPDATE SUPPORT TICKET RESPONSE
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Ticket Status</label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    className="w-full px-3 py-2 mt-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Super Admin Response</label>
                  <textarea
                    rows={4}
                    value={adminResponseText}
                    onChange={(e) => setAdminResponseText(e.target.value)}
                    placeholder="Provide resolution details or official update..."
                    className="w-full px-3 py-2 mt-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedComplaint(null)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded font-bold text-xs"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs shadow-lg flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "SAVING..." : "SUBMIT TICKET UPDATE"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
