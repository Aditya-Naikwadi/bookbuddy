import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  ShieldCheck,
  Globe,
  Mail,
  User,
  AlertTriangle,
  RefreshCw,
  Eye,
} from 'lucide-react';
import registrationApi from '../../../api/registrationApi';

export default function OnboardingReviewQueue() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Rejection Modal State
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await registrationApi.getPendingOnboardings();
      setRequests(res.data || []);
    } catch (err) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to load pending onboarding applications.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const handleApprove = async (reqId, legalName) => {
    if (!window.confirm(`Are you sure you want to approve tenant onboarding for ${legalName}? This will atomically create the College tenant and primary College Admin account.`)) {
      return;
    }

    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await registrationApi.approveOnboarding(reqId);
      setMessage({
        type: 'success',
        text: `Tenant ${legalName} approved and activated successfully!`,
      });
      fetchPendingRequests();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to approve tenant onboarding application.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingRequest || !rejectionReason.trim()) return;

    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await registrationApi.rejectOnboarding(rejectingRequest._id, rejectionReason.trim());
      setMessage({
        type: 'success',
        text: `Application for ${rejectingRequest.tenantData?.legalName} rejected.`,
      });
      setRejectingRequest(null);
      setRejectionReason('');
      fetchPendingRequests();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reject application.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Tenant Onboarding Review Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and approve pending college onboarding applications. Approvals execute an atomic creation of tenant boundary and initial admin account.
          </p>
        </div>

        <button
          onClick={fetchPendingRequests}
          disabled={isLoading}
          className="self-start sm:self-auto py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Alert Notification */}
      {message.text && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Queue List */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 font-medium animate-pulse">
          Loading pending onboarding queue...
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">
            No Pending Onboarding Applications
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            All tenant onboarding requests have been reviewed and processed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {requests.map((req) => {
            const tenant = req.tenantData || {};
            return (
              <div
                key={req._id}
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-md hover:shadow-lg transition-all space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700/60">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs tracking-wider uppercase border border-indigo-200 dark:border-indigo-800">
                        {tenant.institutionType || 'College'}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Submitted: {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                      {tenant.legalName} {tenant.shortName ? `(${tenant.shortName})` : ''}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setRejectingRequest(req)}
                      disabled={isSubmitting}
                      className="py-2.5 px-5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApprove(req._id, tenant.legalName)}
                      disabled={isSubmitting}
                      className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve & Activate Tenant</span>
                    </button>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 dark:text-slate-300">
                  {/* Column 1: Institution Info */}
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-500" /> Institution Details
                    </h4>
                    <p className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Domain: <strong>{tenant.domain}</strong></span>
                    </p>
                    <p className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Slug: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{tenant.desiredSlug}</strong></span>
                    </p>
                    <p>
                      Domain Verified:{' '}
                      <strong className={tenant.isDomainVerified ? 'text-emerald-600' : 'text-amber-600'}>
                        {tenant.isDomainVerified ? 'Verified' : 'Pending Verification Link'}
                      </strong>
                    </p>
                  </div>

                  {/* Column 2: Admin Info */}
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-indigo-500" /> Admin Applicant
                    </h4>
                    <p>Name: <strong>{tenant.adminName}</strong></p>
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Email: <strong>{tenant.adminEmail}</strong></span>
                    </p>
                    <p>Role: <strong>{tenant.designation}</strong></p>
                  </div>

                  {/* Column 3: Verification Document */}
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-500" /> Proof Document
                      </h4>
                      <p className="text-slate-500">
                        {tenant.verificationDocumentUrl
                          ? 'Uploaded accreditation certificate / business document.'
                          : 'No document attached.'}
                      </p>
                    </div>

                    {tenant.verificationDocumentUrl && (
                      <a
                        href={tenant.verificationDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline mt-2"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View / Download Document</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectingRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Reject Tenant Onboarding
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Rejecting <strong>{rejectingRequest.tenantData?.legalName}</strong>. Please provide a clear reason for rejection. The applicant will be notified by email and allowed to resubmit.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State reason for rejection (e.g. Invalid proof document attached)"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectingRequest(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
