import { Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function HelpdeskDesk() {
  const queryClient = useQueryClient();

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ["helpdeskTickets"],
    queryFn: () => collegeAdminApi.getHelpdeskTickets(),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, responseNote }) =>
      collegeAdminApi.resolveHelpdeskTicket(id, {
        status: "resolved",
        responseNote,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdeskTickets"] });
    },
  });

  const tickets = ticketsData?.data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      <div className="border-b border-slate-800 pb-6">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
          Campus Helpdesk
        </span>
        <h1 className="text-3xl font-serif font-bold text-white mt-1">
          Student Complaints & Ticket Support Desk
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Respond to student library inquiries, facility complaints, and book
          support tickets.
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-indigo-400" size={20} /> Loading
          support tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No open support tickets or complaints recorded.
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div
              key={t._id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-base">
                    {t.subject || t.category || "Support Ticket"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    By {t.userId?.name || "Student"} ({t.userId?.email})
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono border ${
                    t.status === "resolved"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                {t.description || t.message || "No ticket text body provided."}
              </p>
              {t.status !== "resolved" && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() =>
                      resolveMutation.mutate({
                        id: t._id,
                        responseNote:
                          "Issue reviewed and resolved by campus librarian.",
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                  >
                    Mark Ticket Resolved
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
