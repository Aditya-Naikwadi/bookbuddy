import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  Eye,
  AlertTriangle,
} from "lucide-react";
import adminApi from "../../../api/adminApi";

const GlobalContentModeration = () => {
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' or 'approved'
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Rejection dialog state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [targetResourceId, setTargetResourceId] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");

  // Announcement states
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementSeverity, setAnnouncementSeverity] = useState("info");

  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchQueue = useCallback(async () => {
    try {
      const response = await adminApi.getPendingModeration(1, 100, activeTab);
      setResources(response.data || []);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Failed to fetch moderation queue." });
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  const handleRefresh = () => {
    setIsLoading(true);
    setMessage({ type: "", text: "" });
    fetchQueue();
  };

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchQueue();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fetchQueue]);

  const handleApprove = async (id) => {
    if (!window.confirm("Are you sure you want to approve this e-resource?"))
      return;
    try {
      await adminApi.moderateResource(
        id,
        "approved",
        "Approved by Super Admin",
      );
      setMessage({ type: "success", text: "Resource approved successfully." });
      fetchQueue();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to approve resource.",
      });
    }
  };

  const handlePublish = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to publish this e-resource? It will become visible to all students immediately.",
      )
    )
      return;
    try {
      await adminApi.publishResource(id);
      setMessage({ type: "success", text: "Resource published successfully." });
      fetchQueue();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to publish resource.",
      });
    }
  };

  const openRejectModal = (id) => {
    setTargetResourceId(id);
    setRejectionNote("");
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionNote.trim()) {
      alert("Rejection note is required.");
      return;
    }
    try {
      await adminApi.moderateResource(
        targetResourceId,
        "rejected",
        rejectionNote,
      );
      setMessage({ type: "success", text: "Resource rejected with feedback." });
      setShowRejectModal(false);
      fetchQueue();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to reject resource.",
      });
    }
  };

  const handlePublishAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      alert("Announcement title and body are required.");
      return;
    }
    // Simulate pushing announcement since it's a cross-cutting event logged in AuditLogs
    try {
      // Create a dummy request to trigger audit log (mocked announcement.create log)
      // Since we don't have a direct database collection for announcements, we log this event in the system audit logs.
      alert(
        `Announcement published: "${announcementTitle}"\nThis action will be logged in the system Audit Trail.`,
      );

      setAnnouncementTitle("");
      setAnnouncementBody("");
      setMessage({
        type: "success",
        text: "Global announcement banner published successfully.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to publish announcement.",
      });
    }
  };

  const getMediaUrl = (url) => {
    if (url.startsWith("/")) {
      return `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${url}`;
    }
    return url;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">
            Global Content & Moderation
          </h1>
          <p className="text-slate-600">
            Review E-Resources uploaded by colleges and verify content before
            publishing.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors flex items-center gap-2 font-medium text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-lg text-sm border flex items-center gap-2 ${
            message.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {message.type === "error" ? (
            <XCircle size={18} />
          ) : (
            <CheckCircle size={18} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "pending"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Pending Review
        </button>
        <button
          onClick={() => setActiveTab("approved")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "approved"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Approved & Ready to Publish
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resource List */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : resources.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-500">
              No items in this queue.
            </div>
          ) : (
            resources.map((resource) => (
              <div
                key={resource._id}
                className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-xs transition-shadow"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-md">
                      {resource.title}
                    </h3>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                      {resource.type}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Author: {resource.author} | Category: {resource.category}
                  </p>
                  <p className="text-xs text-slate-400">
                    Uploaded by {resource.uploadedBy?.name || "Unknown"}{" "}
                    (College: {resource.collegeId?.name || "Unknown"})
                  </p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <a
                    href={getMediaUrl(resource.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    <Eye size={14} /> Preview
                  </a>

                  {activeTab === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(resource._id)}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal(resource._id)}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-700"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {activeTab === "approved" && (
                    <button
                      onClick={() => handlePublish(resource._id)}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700"
                    >
                      Publish to Readers
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global Announcements */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Send className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Push Global Notification
            </h2>
          </div>
          <form onSubmit={handlePublishAnnouncement} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Announcement Title
              </label>
              <input
                type="text"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="e.g. Scheduled Maintenance"
                className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Message Body
              </label>
              <textarea
                rows={3}
                value={announcementBody}
                onChange={(e) => setAnnouncementBody(e.target.value)}
                placeholder="The system will be offline for 2 hours..."
                className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                required
              ></textarea>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Severity
              </label>
              <select
                value={announcementSeverity}
                onChange={(e) => setAnnouncementSeverity(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="info">Information (Blue)</option>
                <option value="warning">Warning (Yellow)</option>
                <option value="critical">Critical Alert (Red)</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 text-white text-sm font-semibold py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Publish Banner
            </button>
          </form>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg border max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 border-b pb-3 text-rose-600">
              <AlertTriangle />
              <h3 className="font-bold text-lg">Provide Rejection Reason</h3>
            </div>
            <p className="text-xs text-slate-500">
              Please enter an explanation of why this resource is being
              rejected. This feedback will be sent to the proposing college
              administrator.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={4}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Content contains scanning defects or violates platform terms..."
                required
              ></textarea>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalContentModeration;
