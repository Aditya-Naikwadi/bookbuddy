import { AlertCircle } from "lucide-react";

export default function ServiceDependencyNotice({ notices = [] }) {
  if (!notices || notices.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5 text-amber-900 text-xs flex items-start gap-2.5 shadow-sm">
      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <span className="font-semibold block text-amber-950">
          Module Dependency Auto-Resolved
        </span>
        <ul className="list-disc list-inside space-y-0.5 text-amber-800">
          {notices.map((notice, idx) => (
            <li key={idx}>{notice}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
