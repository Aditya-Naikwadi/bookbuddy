export default function PhasedFeaturePlaceholder({
  title,
  description,
  phase,
  flagKey,
}) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-surface border border-slate-200 dark:border-edge rounded-2xl p-6 shadow-sm">
        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 inline-block">
          {phase || "Approved Module"}
        </span>
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-ink mb-2">
          {title}
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 leading-relaxed">
          {description}
        </p>
        <div className="text-xs text-slate-500 border-t border-slate-100 dark:border-edge pt-4 flex items-center justify-between">
          <span>
            Feature Flag:{" "}
            <code className="font-mono bg-slate-100 dark:bg-void px-2 py-0.5 rounded text-indigo-600">
              {flagKey}
            </code>
          </span>
          <span className="text-emerald-600 font-medium">
            Licensed & Active for this Tenant
          </span>
        </div>
      </div>
    </div>
  );
}
