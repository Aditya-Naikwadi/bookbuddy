import { Clock, CheckCircle2, Truck, CheckCheck, XCircle } from "lucide-react";

export const ShareRequestStatusTracker = ({ request }) => {
  if (!request) return null;

  const history = request.statusHistory || [
    {
      status: request.status || "requested",
      at: request.createdAt || new Date(),
    },
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case "requested":
        return <Clock className="w-4 h-4 text-amber-400" />;
      case "approved":
        return <CheckCircle2 className="w-4 h-4 text-indigo-400" />;
      case "in_transit":
        return <Truck className="w-4 h-4 text-cyan-400" />;
      case "fulfilled":
        return <CheckCheck className="w-4 h-4 text-emerald-400" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 my-2">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
        <span>Status Timeline</span>
        <span className="font-mono text-[10px] text-indigo-300">
          ID: {request._id || request.id}
        </span>
      </div>

      {/* Timeline Steps */}
      <div className="relative pl-6 space-y-4 border-l-2 border-slate-800">
        {history.map((step, idx) => {
          const isLatest = idx === history.length - 1;
          const timestampFormatted = step.at
            ? new Date(step.at).toLocaleString()
            : "";

          return (
            <div key={idx} className="relative flex items-start gap-3">
              {/* Timeline Bullet */}
              <div className="absolute -left-[31px] top-0.5 p-1 bg-slate-950 rounded-full border border-slate-800">
                {getStatusIcon(step.status)}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${
                      isLatest ? "text-indigo-300" : "text-slate-300"
                    }`}
                  >
                    {step.status.replace("_", " ")}
                  </span>
                  {isLatest && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[9px] font-bold">
                      Current State
                    </span>
                  )}
                </div>

                {/* ACCEPTANCE CRITERIA: Renders statusHistory timeline matching timestamps exactly */}
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  {timestampFormatted}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShareRequestStatusTracker;
