import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export default function RowValidationBadge({ status, errorCount = 0 }) {
  if (status === "valid") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 size={12} className="text-emerald-600" />
        Valid
      </span>
    );
  }

  if (status === "warning") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <AlertTriangle size={12} className="text-amber-600" />
        Warning
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
      <XCircle size={12} className="text-rose-600" />
      Error ({errorCount})
    </span>
  );
}
