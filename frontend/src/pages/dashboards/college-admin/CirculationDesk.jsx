import { useState } from "react";
import { ArrowRightLeft, UserCheck, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";
import { useSocket } from "../../../hooks/useSocket";

export default function CirculationDesk() {
  const { isConnected, isPaused } = useSocket();
  const [checkoutUser, setCheckoutUser] = useState("");
  const [checkoutBookId, setCheckoutBookId] = useState("");
  const [returnLoanId, setReturnLoanId] = useState("");
  const [activeTab, setActiveTab] = useState("loans");
  const [page] = useState(1);

  const {
    data: queueData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["circulationQueue", { page }],
    queryFn: () => collegeAdminApi.getCirculationQueue({ page, limit: 25 }),
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload) => collegeAdminApi.checkoutBook(payload),
    onSuccess: () => {
      setCheckoutUser("");
      setCheckoutBookId("");
    },
  });

  const returnMutation = useMutation({
    mutationFn: (payload) => collegeAdminApi.returnBook(payload),
    onSuccess: () => {
      setReturnLoanId("");
    },
  });

  const reservations = Array.isArray(queueData?.data)
    ? queueData.data
    : Array.isArray(queueData)
      ? queueData
      : queueData?.reservations || [];
  const loans = queueData?.activeLoans || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
            Circulation Desk
          </span>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Physical Book Circulation Desk
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage student checkouts, counter returns, and active reservation
            hold queues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono border ${
              isConnected && !isPaused
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isConnected && !isPaused ? "bg-emerald-400" : "bg-amber-400"
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isConnected && !isPaused ? "bg-emerald-500" : "bg-amber-500"
                }`}
              ></span>
            </span>
            <span>
              {isConnected && !isPaused
                ? "OPAC Live Sync Active"
                : "Live Updates Paused"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Checkout Form */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <UserCheck className="text-emerald-400" size={20} />
            Quick Checkout Counter
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (checkoutUser && checkoutBookId) {
                checkoutMutation.mutate({
                  userId: checkoutUser,
                  bookId: checkoutBookId,
                });
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Student ID / Email
              </label>
              <input
                type="text"
                required
                value={checkoutUser}
                onChange={(e) => setCheckoutUser(e.target.value)}
                placeholder="Enter Student ID or Email"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Book Catalog ID / Accession No.
              </label>
              <input
                type="text"
                required
                value={checkoutBookId}
                onChange={(e) => setCheckoutBookId(e.target.value)}
                placeholder="Enter Book Catalog ID"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={checkoutMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs text-white transition-colors flex items-center justify-center gap-2"
            >
              {checkoutMutation.isPending && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Issue Loan to Student
            </button>
          </form>
        </div>

        {/* Return Form */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="text-indigo-400" size={20} />
            Quick Book Return
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (returnLoanId) {
                returnMutation.mutate({ loanId: returnLoanId });
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Active Loan ID / Book ID
              </label>
              <input
                type="text"
                required
                value={returnLoanId}
                onChange={(e) => setReturnLoanId(e.target.value)}
                placeholder="Enter Loan ID or Scan Barcode"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="pt-7">
              <button
                type="submit"
                disabled={returnMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs text-white transition-colors flex items-center justify-center gap-2"
              >
                {returnMutation.isPending && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Process Return & Restock
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Queue & Loans Tables */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-800 text-sm font-semibold gap-6">
          <button
            onClick={() => setActiveTab("loans")}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === "loans"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Active Campus Loans ({loans.length})
          </button>
          <button
            onClick={() => setActiveTab("reservations")}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === "reservations"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Pending Hold Queue ({reservations.length})
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-indigo-400" size={20} />
            Loading circulation data...
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-rose-400 bg-rose-950/20 border border-rose-900/50 rounded-2xl flex flex-col items-center gap-2">
            <AlertCircle size={24} />
            <p className="text-sm font-medium">
              Failed to load circulation records
            </p>
            <p className="text-xs text-slate-400">
              {error?.message || "Please check your network and retry."}
            </p>
          </div>
        ) : activeTab === "loans" ? (
          loans.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
              No active loans currently recorded for this campus.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase">
                  <tr>
                    <th className="p-3.5">Student / Patron</th>
                    <th className="p-3.5">Book Title</th>
                    <th className="p-3.5">Issue Date</th>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5">Renewals</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t border-slate-800 divide-slate-800 text-slate-300">
                  {loans.map((loan) => (
                    <tr
                      key={loan._id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3.5 font-medium text-white">
                        {loan.userId?.name || "Student"} (
                        {loan.userId?.email || loan.userId?.studentId})
                      </td>
                      <td className="p-3.5">
                        {loan.bookId?.title || "Physical Book"}
                      </td>
                      <td className="p-3.5 font-mono">
                        {loan.issueDate
                          ? new Date(loan.issueDate).toLocaleDateString()
                          : loan.createdAt
                            ? new Date(loan.createdAt).toLocaleDateString()
                            : "—"}
                      </td>
                      <td className="p-3.5 font-mono">
                        {loan.dueDate
                          ? new Date(loan.dueDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="p-3.5 font-mono text-[11px]">
                        {loan.renewalCount || 0} / {loan.maxRenewals || 2}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            loan.status === "overdue"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : reservations.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
            No pending reservations in hold queue.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase">
                <tr>
                  <th className="p-3.5">Queue #</th>
                  <th className="p-3.5">Student</th>
                  <th className="p-3.5">Book Title</th>
                  <th className="p-3.5">Reservation Date</th>
                  <th className="p-3.5">Pickup Deadline</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t border-slate-800 divide-slate-800 text-slate-300">
                {reservations.map((res) => (
                  <tr
                    key={res._id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3.5 font-mono font-bold text-indigo-400">
                      #{res.queuePosition}
                    </td>
                    <td className="p-3.5 font-medium text-white">
                      {res.userId?.name || "Student"}
                    </td>
                    <td className="p-3.5">{res.bookId?.title || "Book"}</td>
                    <td className="p-3.5 font-mono">
                      {res.createdAt
                        ? new Date(res.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      {res.expiresAt
                        ? new Date(res.expiresAt).toLocaleTimeString()
                        : "—"}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          res.status === "ready_for_pickup"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {res.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
