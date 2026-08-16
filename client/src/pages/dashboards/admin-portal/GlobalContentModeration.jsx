import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Eye, Building2 } from "lucide-react";
import eresourcesApi from "../../../api/eresourcesApi";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";
import OpsSeverityBadge from "../../../components/ops/OpsSeverityBadge";
import DigitalReaderModal from "../../../components/general/DigitalReaderModal";

export default function GlobalContentModeration() {
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' | 'history'
  const [selectedResource, setSelectedResource] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Digital Reader Modal State
  const [readerModalItem, setReaderModalItem] = useState(null);

  const [reloadToken, setReloadToken] = useState(0);

  const fetchModerationQueue = useCallback(
    () => setReloadToken((t) => t + 1),
    [],
  );

  useEffect(() => {
    let ignore = false;
    async function loadQueue() {
      try {
        setIsLoading(true);
        const data = await eresourcesApi.getAllResources();
        if (!ignore) setResources(data || []);
      } catch (err) {
        console.error(err);
        if (!ignore) {
          setMessage({
            type: "error",
            text: "Failed to load e-resource moderation queue.",
          });
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    loadQueue();
    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  const pendingItems = resources.filter(
    (r) =>
      r.moderationStatus === "pending" ||
      r.status === "pending_review" ||
      !r.moderationStatus,
  );
  const historyItems = resources.filter(
    (r) =>
      r.moderationStatus === "approved" || r.moderationStatus === "rejected",
  );

  const displayedItems = activeTab === "pending" ? pendingItems : historyItems;

  const handleApprove = async (resourceId) => {
    setIsSubmitting(true);
    setMessage({ type: "", text: "" });
    try {
      if (adminApi.moderateEResource) {
        await adminApi.moderateEResource(resourceId, {
          status: "approved",
          reason:
            "Content verified and approved for platform-wide library access.",
        });
      } else {
        await eresourcesApi.updateResource(resourceId, {
          moderationStatus: "approved",
          isApproved: true,
        });
      }

      setMessage({
        type: "success",
        text: "E-Resource approved successfully for platform distribution.",
      });

      // Update local state
      setResources((prev) =>
        prev.map((r) =>
          r._id === resourceId ? { ...r, moderationStatus: "approved" } : r,
        ),
      );

      // Auto Advance to next pending item if enabled
      if (autoAdvance) {
        const remaining = pendingItems.filter((r) => r._id !== resourceId);
        setSelectedResource(remaining[0] || null);
      } else {
        setSelectedResource(null);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to approve e-resource.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (resourceId) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a mandatory rejection reason.");
      return;
    }

    setIsSubmitting(true);
    setMessage({ type: "", text: "" });
    try {
      if (adminApi.moderateEResource) {
        await adminApi.moderateEResource(resourceId, {
          status: "rejected",
          reason: rejectionReason.trim(),
        });
      } else {
        await eresourcesApi.updateResource(resourceId, {
          moderationStatus: "rejected",
          isApproved: false,
          rejectionReason: rejectionReason.trim(),
        });
      }

      setMessage({
        type: "success",
        text: "E-Resource rejected with reason logged.",
      });

      setResources((prev) =>
        prev.map((r) =>
          r._id === resourceId
            ? {
                ...r,
                moderationStatus: "rejected",
                rejectionReason: rejectionReason.trim(),
              }
            : r,
        ),
      );

      setRejectionReason("");

      if (autoAdvance) {
        const remaining = pendingItems.filter((r) => r._id !== resourceId);
        setSelectedResource(remaining[0] || null);
      } else {
        setSelectedResource(null);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to reject e-resource.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <OpsHeader
        title="Global Content Moderation"
        subtitle="Review uploaded digital e-books, open-access research papers, and educational materials across institutional libraries"
        onRefresh={fetchModerationQueue}
        isRefreshing={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notification Alert */}
        {message.text && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-xs ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage({ type: "", text: "" })}
              className="hover:underline font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab & Auto-Advance Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border ${
                activeTab === "pending"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>Pending Queue</span>
              <OpsSeverityBadge
                status="warning"
                label={String(pendingItems.length)}
                size="sm"
              />
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border ${
                activeTab === "history"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>Moderation History</span>
              <span className="text-xs text-slate-400 font-normal">
                ({historyItems.length})
              </span>
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Auto-advance to next item upon decision</span>
          </label>
        </div>

        {/* Split-Pane Queue Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Item Queue List */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {activeTab === "pending"
                ? "Pending Items Review Queue"
                : "Historical Moderation Decisions"}
            </h3>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {displayedItems.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-xs font-medium shadow-xs">
                  Zero items match current moderation scope.
                </div>
              ) : (
                displayedItems.map((item) => {
                  const isSelected = selectedResource?._id === item._id;
                  const status = item.moderationStatus || "pending";

                  return (
                    <div
                      key={item._id}
                      onClick={() => setSelectedResource(item)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                        isSelected
                          ? "bg-indigo-50/50 border-indigo-200 shadow-xs"
                          : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                          {item.title || "Untitled E-Resource"}
                        </h4>
                        <OpsSeverityBadge status={status} size="sm" />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1 text-indigo-600">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{item.collegeName || "Institution Asset"}</span>
                        </span>
                        <span className="text-[11px] font-normal uppercase text-slate-400">
                          {item.format || "PDF"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Item Inspector & Decision Panel */}
          <div className="lg:col-span-7">
            {selectedResource ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-500 uppercase font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      Content Inspection
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-2">
                      {selectedResource.title}
                    </h3>
                  </div>
                  <OpsSeverityBadge
                    status={selectedResource.moderationStatus || "pending"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Category
                    </span>
                    <div className="text-slate-200">
                      {selectedResource.category || "General Library"}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Uploaded By
                    </span>
                    <div className="text-slate-200">
                      {selectedResource.uploadedBy || "College Librarian"}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Description
                  </span>
                  <p className="text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 leading-relaxed text-[11px]">
                    {selectedResource.description ||
                      "No description provided by uploader."}
                  </p>
                </div>

                {/* Preview Trigger Button */}
                <div className="bg-slate-950 p-3 rounded border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Content Preview Source
                  </span>
                  <button
                    onClick={() => setReaderModalItem(selectedResource)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>LAUNCH DIGITAL READER PREVIEW</span>
                  </button>
                </div>

                {/* Decision Action Box */}
                {activeTab === "pending" && (
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 pt-4 border-t border-indigo-500/30">
                    <span className="text-xs font-bold text-slate-200 uppercase">
                      Moderation Decision & Enforcement
                    </span>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold">
                        Rejection Reason (Mandatory if Rejecting)
                      </label>
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="State clear, actionable rejection reason..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => handleApprove(selectedResource._id)}
                        disabled={isSubmitting}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>APPROVE RESOURCE</span>
                      </button>

                      <button
                        onClick={() => handleReject(selectedResource._id)}
                        disabled={isSubmitting || !rejectionReason.trim()}
                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>REJECT RESOURCE</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs font-mono">
                Select an item from the queue list to inspect content and
                execute moderation decision.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Reader Modal */}
      {readerModalItem && (
        <DigitalReaderModal
          resource={readerModalItem}
          onClose={() => setReaderModalItem(null)}
        />
      )}
    </div>
  );
}
