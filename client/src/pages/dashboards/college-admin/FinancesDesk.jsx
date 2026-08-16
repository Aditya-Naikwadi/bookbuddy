import { Receipt, CheckCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function FinancesDesk() {
  const queryClient = useQueryClient();

  const { data: finesData, isLoading } = useQuery({
    queryKey: ["collegeFines"],
    queryFn: () => collegeAdminApi.getCollegeFines(),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount }) =>
      collegeAdminApi.payCollegeFine(id, {
        amountPaid: amount,
        paymentMethod: "cash",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collegeFines"] });
    },
  });

  const fines = finesData?.data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      <div className="border-b border-slate-800 pb-6">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
          Campus Finances
        </span>
        <h1 className="text-3xl font-serif font-bold text-white mt-1">
          Fine Collections & Overdue Ledger
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Audit overdue library fines, process cash settlements at counter, and
          view fee collection logs.
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-indigo-400" size={20} /> Loading
          fine ledger...
        </div>
      ) : fines.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No outstanding or processed fines recorded for this campus.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase">
              <tr>
                <th className="p-3.5">Student Patron</th>
                <th className="p-3.5">Reason</th>
                <th className="p-3.5">Amount Due</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {fines.map((fine) => (
                <tr key={fine._id}>
                  <td className="p-3.5 font-bold text-white">
                    {fine.userId?.name || "Student"} ({fine.userId?.email})
                  </td>
                  <td className="p-3.5">
                    {fine.reason || "Overdue Book Return"}
                  </td>
                  <td className="p-3.5 font-mono text-emerald-400 font-bold">
                    ₹{fine.amount}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] ${
                        fine.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {fine.status}
                    </span>
                  </td>
                  <td className="p-3.5">
                    {fine.status !== "paid" && (
                      <button
                        onClick={() =>
                          payMutation.mutate({
                            id: fine._id,
                            amount: fine.amount,
                          })
                        }
                        disabled={payMutation.isPending}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 font-medium text-white rounded-lg text-[11px]"
                      >
                        Settle Cash Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
