import { useState } from "react";
import { BookOpen, CheckCircle, ArrowRightLeft, UserCheck, Loader2, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function CirculationDesk() {
  const queryClient = useQueryClient();
  const [checkoutUser, setCheckoutUser] = useState("");
  const [checkoutBookId, setCheckoutBookId] = useState("");
  const [returnLoanId, setReturnLoanId] = useState("");
  const [activeTab, setActiveTab] = useState("loans");

  const { data: queueData, isLoading } = useQuery({
    queryKey: ["circulationQueue"],
    queryFn: () => collegeAdminApi.getCirculationQueue(),
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload) => collegeAdminApi.checkoutBook(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circulationQueue"] });
      setCheckoutUser("");
      setCheckoutBookId("");
    },
  });

  const returnMutation = useMutation({
    mutationFn: (payload) => collegeAdminApi.returnBook(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circulationQueue"] });
      setReturnLoanId("");
    },
  });

  const loans = queueData?.activeLoans || [];
  const reservations = queueData?.reservations || [];

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
            Manage student checkouts, counter returns, and active reservation hold queues.
          </p>
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
              {checkoutMutation.isPending && <Loader2 size={14} className="animate-spin" />}
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
                {returnMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Process Return & Restock
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Queue Table */}
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
            <Loader2 className="animate-spin text-indigo-400" size={20} /> Loading circulation data...
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
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {loans.map((loan) => (
                    <tr key={loan._id}>
                      <td className="p-3.5 font-medium text-white">
                        {loan.userId?.name || "Student"} ({loan.userId?.email})
                      </td>
                      <td className="p-3.5">{loan.bookId?.title || "Physical Book"}</td>
                      <td className="p-3.5 font-mono">
                        {new Date(loan.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 font-mono">
                        {new Date(loan.dueDate).toLocaleDateString()}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {loan.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          reservations.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
              No pending reservations in hold queue.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase">
                  <tr>
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Book Title</th>
                    <th className="p-3.5">Reservation Date</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {reservations.map((res) => (
                    <tr key={res._id}>
                      <td className="p-3.5 font-medium text-white">
                        {res.userId?.name || "Student"}
                      </td>
                      <td className="p-3.5">{res.bookId?.title || "Book"}</td>
                      <td className="p-3.5 font-mono">
                        {new Date(res.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
