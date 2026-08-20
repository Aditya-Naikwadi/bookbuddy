import React, { useState, useEffect } from 'react';
import {
  Share2,
  CheckCircle2,
  XCircle,
  Truck,
  CheckCheck,
  Clock,
  Building2,
  User,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const IncomingShareRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchIncomingQueue = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/share-requests/incoming', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.data || []);
      } else {
        setErrorMsg(data.message || 'Failed to fetch incoming share requests queue.');
      }
    } catch (err) {
      console.error('Error loading incoming share requests:', err);
      setErrorMsg('Network error fetching share requests queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomingQueue();
  }, []);

  const handleStatusUpdate = async (requestId, newStatus) => {
    try {
      setUpdatingId(requestId);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/share-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Refresh queue
        await fetchIncomingQueue();
      } else {
        alert(data.message || 'Status transition rejected by state machine or authorization rules.');
      }
    } catch (err) {
      console.error('Status update error:', err);
      alert('Network error updating share request status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'requested':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Approved
          </span>
        );
      case 'in_transit':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-cyan-400" /> In Transit
          </span>
        );
      case 'fulfilled':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Fulfilled
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-400" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-indigo-400" /> Inter-Library Loan Queue
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Share2 className="w-8 h-8 text-indigo-400" /> Incoming Share Requests
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review and fulfill cross-college resource requests originating from partner institution students.
          </p>
        </div>

        <button
          onClick={fetchIncomingQueue}
          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-800 flex items-center gap-2 text-xs font-medium self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-sm flex items-center gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Queue Section */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl">
        {loading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-800/40 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-slate-800/80 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <Share2 className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No Incoming Share Requests</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              There are currently no pending inter-library loan requests for your college's resources.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {requests.map((reqItem) => {
              const requestingCollege = reqItem.requestingCollegeId || {};
              const requestingStudent = reqItem.requestedBy || {};

              return (
                <div
                  key={reqItem._id}
                  className="py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 group hover:bg-slate-800/30 px-4 rounded-2xl transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(reqItem.status)}
                      <span className="text-xs text-slate-500 font-mono">
                        ID: {reqItem._id.substring(0, 10)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <Building2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                      <div>
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          Requesting Institution
                        </span>
                        <div className="text-white font-bold text-base">
                          {requestingCollege.name || 'Partner College'} ({requestingCollege.shortName || 'CAMPUS'})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <User className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      <div className="text-xs text-slate-300">
                        Requested by <strong className="text-white">{requestingStudent.name || 'Student'}</strong> ({requestingStudent.email || 'N/A'})
                      </div>
                    </div>
                  </div>

                  {/* State Machine Transition Action Buttons */}
                  <div className="flex items-center gap-3 self-end lg:self-center">
                    {reqItem.status === 'requested' && (
                      <>
                        <button
                          disabled={updatingId === reqItem._id}
                          onClick={() => handleStatusUpdate(reqItem._id, 'approved')}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          disabled={updatingId === reqItem._id}
                          onClick={() => handleStatusUpdate(reqItem._id, 'rejected')}
                          className="px-4 py-2 rounded-xl bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-semibold text-xs transition-all border border-rose-700/50 flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}

                    {reqItem.status === 'approved' && (
                      <button
                        disabled={updatingId === reqItem._id}
                        onClick={() => handleStatusUpdate(reqItem._id, 'in_transit')}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Dispatch (In Transit)</span>
                      </button>
                    )}

                    {reqItem.status === 'in_transit' && (
                      <button
                        disabled={updatingId === reqItem._id}
                        onClick={() => handleStatusUpdate(reqItem._id, 'fulfilled')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark Fulfilled</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default IncomingShareRequests;
