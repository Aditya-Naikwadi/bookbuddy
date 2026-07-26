import { useState, useEffect } from "react";
import {
  FileSearch,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";
import adminApi from "../../../api/adminApi";

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: 10,
      };
      if (selectedCollegeId) params.collegeId = selectedCollegeId;
      if (selectedAction) params.action = selectedAction;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await adminApi.getAuditLogs(params);
      setLogs(response.data || []);
      setTotalLogs(response.pagination?.total || 0);
      setTotalPages(response.pagination?.pages || 1);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch system audit logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const getFilters = async () => {
      try {
        const collegesData = await adminApi.listColleges();
        if (!ignore) {
          setColleges(collegesData);
        }
      } catch (err) {
        console.error("Failed to load filter directories", err);
      }
    };
    getFilters();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const getLogs = async () => {
      setIsLoading(true);
      setError("");
      try {
        const params = {
          page,
          limit: 10,
        };
        if (selectedCollegeId) params.collegeId = selectedCollegeId;
        if (selectedAction) params.action = selectedAction;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const response = await adminApi.getAuditLogs(params);
        if (!ignore) {
          setLogs(response.data || []);
          setTotalLogs(response.pagination?.total || 0);
          setTotalPages(response.pagination?.pages || 1);
        }
      } catch (err) {
        if (!ignore) {
          console.error(err);
          setError("Failed to fetch system audit logs.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    getLogs();
    return () => {
      ignore = true;
    };
  }, [page, selectedCollegeId, selectedAction, startDate, endDate]);

  const handleClearFilters = () => {
    setSelectedCollegeId("");
    setSelectedAction("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toISOString().replace("T", " ").substring(0, 19);
  };

  const viewDetails = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">
            Security & Audit Logs
          </h1>
          <p className="text-slate-600">
            System-wide forensic tracking of administrative and user actions.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors flex items-center gap-2 font-medium text-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filter panel */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold border-b pb-2">
          <Filter size={18} />
          <span>Filter Logs</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target College
            </label>
            <select
              value={selectedCollegeId}
              onChange={(e) => {
                setSelectedCollegeId(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Colleges</option>
              {colleges.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Action Type
            </label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Actions</option>
              <option value="college.create">college.create</option>
              <option value="college.status_change">
                college.status_change
              </option>
              <option value="college_admin.create">college_admin.create</option>
              <option value="college_admin.revoke">college_admin.revoke</option>
              <option value="eresource.moderate">eresource.moderate</option>
              <option value="eresource.publish">eresource.publish</option>
              <option value="circulation.checkout">circulation.checkout</option>
              <option value="circulation.return">circulation.return</option>
              <option value="fine.pay">fine.pay</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full py-2 border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-semibold transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSearch className="text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">
              System Events ({totalLogs})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No events match the filter parameters.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600 font-mono">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-900 font-sans">
                <tr>
                  <th className="p-3 font-semibold rounded-tl-lg">Timestamp</th>
                  <th className="p-3 font-semibold">Actor Role</th>
                  <th className="p-3 font-semibold">Actor Name</th>
                  <th className="p-3 font-semibold">Action</th>
                  <th className="p-3 font-semibold">IP Address</th>
                  <th className="p-3 font-semibold rounded-tr-lg text-right">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log._id}
                    className="border-b border-slate-100 hover:bg-slate-50 text-xs"
                  >
                    <td className="p-3 whitespace-nowrap flex items-center gap-2">
                      <Clock size={12} className="text-slate-400" />
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans uppercase ${
                          log.actorRole === "super-admin"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="p-3 font-bold font-sans text-slate-900">
                      {log.actorId
                        ? `${log.actorId.name} (${log.actorId.studentId})`
                        : "System / Seed"}
                    </td>
                    <td className="p-3 font-bold font-sans text-slate-800">
                      {log.action}
                    </td>
                    <td className="p-3 text-slate-500">
                      {log.ipAddress || "N/A"}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => viewDetails(log)}
                        className="text-indigo-600 hover:text-indigo-900 hover:underline inline-flex items-center gap-1 font-sans font-bold"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 font-sans text-sm">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-xl shadow-lg border max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900">
                Event Metadata Payload
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-slate-500">Action: </span>
                <span className="font-bold text-slate-800">
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">
                  Timestamp:{" "}
                </span>
                <span>{new Date(selectedLog.createdAt).toString()}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">
                  Actor Details:{" "}
                </span>
                <span>
                  {selectedLog.actorId
                    ? `${selectedLog.actorId.name} (${selectedLog.actorId.email})`
                    : "System"}
                </span>
              </div>
              {selectedLog.collegeId && (
                <div>
                  <span className="font-semibold text-slate-500">
                    College:{" "}
                  </span>
                  <span>
                    {selectedLog.collegeId.name} ({selectedLog.collegeId.code})
                  </span>
                </div>
              )}
              {selectedLog.targetType && (
                <div>
                  <span className="font-semibold text-slate-500">
                    Target Type:{" "}
                  </span>
                  <span>
                    {selectedLog.targetType} ({selectedLog.targetId})
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-slate-500 text-sm">
                Metadata Diff:
              </span>
              <pre className="p-3 bg-slate-50 rounded-lg text-xs font-mono overflow-auto max-h-48 border text-slate-800">
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
