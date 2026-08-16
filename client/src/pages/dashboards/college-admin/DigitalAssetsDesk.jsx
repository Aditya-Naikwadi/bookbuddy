import { FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function DigitalAssetsDesk() {
  const queryClient = useQueryClient();

  const { data: resourcesData, isLoading } = useQuery({
    queryKey: ["pendingEResources"],
    queryFn: () => collegeAdminApi.getPendingEResources(),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, status }) => collegeAdminApi.moderateEResource(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingEResources"] });
    },
  });

  const pending = resourcesData?.data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      <div className="border-b border-slate-800 pb-6">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
          Digital Asset Moderation
        </span>
        <h1 className="text-3xl font-serif font-bold text-white mt-1">
          E-Resource Upload Review & Moderation
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review student and faculty digital document submissions before publishing to campus catalog.
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-indigo-400" size={20} /> Loading pending submissions...
        </div>
      ) : pending.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No pending digital asset submissions awaiting moderation.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pending.map((res) => (
            <div key={res._id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white text-base">{res.title}</h4>
                  <p className="text-xs text-slate-400">By {res.author || "Contributor"}</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] uppercase font-mono border border-indigo-500/20">
                  {res.type || "PDF"}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => moderateMutation.mutate({ id: res._id, status: "rejected" })}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold"
                >
                  Reject
                </button>
                <button
                  onClick={() => moderateMutation.mutate({ id: res._id, status: "approved" })}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  Approve & Publish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
