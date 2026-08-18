import { useState } from "react";
import { useBookRequest } from "../../hooks/useBookRequest";
import {
  BookPlus,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";

export default function BookRequest() {
  const { requests, pendingCount, isLoading, createRequest, isSubmitting } =
    useBookRequest();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!title.trim() || !author.trim()) {
      setErrorMsg("Book title and author are required.");
      return;
    }

    try {
      await createRequest({ title, author, isbn, reason });
      setSuccessMsg("Book acquisition request submitted successfully!");
      setTitle("");
      setAuthor("");
      setIsbn("");
      setReason("");
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || "Failed to submit book request.",
      );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3 mr-1" /> Approved
          </span>
        );
      case "fulfilled":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
            <CheckCircle className="w-3 h-3 mr-1" /> Available in Library
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
            <XCircle className="w-3 h-3 mr-1" /> Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            <Clock className="w-3 h-3 mr-1" /> Pending Review
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Request Form */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm h-fit">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400">
            <BookPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">
              Request a New Book
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Suggest titles for library acquisition.
            </p>
          </div>
        </div>

        {pendingCount >= 3 ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs space-y-1">
            <div className="flex items-center font-semibold">
              <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
              Pending Request Limit Reached (3/3)
            </div>
            <p>
              You have 3 active pending book requests under review. Please wait
              for librarian review before submitting new requests.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs rounded-lg">
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Book Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Introduction to Quantum Computing"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Author Name *
              </label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. David Mermin"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                ISBN (Optional)
              </label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="e.g. 978-0521813471"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Reason / Course Syllabus (Optional)
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required for CS402 coursework..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Book Request"}
            </button>
          </form>
        )}
      </div>

      {/* Requests History List */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
          My Submitted Requests ({requests.length})
        </h3>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">
              You haven't submitted any book acquisition requests yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req._id}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                      {req.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      by {req.author} {req.isbn && `• ISBN: ${req.isbn}`}
                    </p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>

                {req.reason && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700/50">
                    "{req.reason}"
                  </p>
                )}

                {req.adminNotes && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                    Librarian note: {req.adminNotes}
                  </p>
                )}
                <div className="text-[10px] text-slate-400">
                  Submitted on {new Date(req.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
