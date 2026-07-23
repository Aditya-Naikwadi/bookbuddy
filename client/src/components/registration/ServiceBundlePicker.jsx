import { Sparkles, Layers, Check } from 'lucide-react';

export default function ServiceBundlePicker({
  services = [],
  selectedKeys = [],
  onSelectBundle,
}) {
  const allKeys = services.map((s) => s.key);
  const coreKeys = services.filter((s) => s.isCore || ['catalog', 'loans', 'patron-card', 'fines'].includes(s.key)).map((s) => s.key);

  const isEssentialsSelected =
    selectedKeys.length === coreKeys.length &&
    coreKeys.every((k) => selectedKeys.includes(k));

  const isFullSuiteSelected =
    selectedKeys.length === allKeys.length &&
    allKeys.every((k) => selectedKeys.includes(k));

  return (
    <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 md:p-5 rounded-2xl text-white mb-6 shadow-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles size={14} />
            <span>Preset Service Bundles</span>
          </div>
          <h3 className="text-base md:text-lg font-semibold text-white">
            Quick-start with curated module presets
          </h3>
          <p className="text-slate-300 text-xs mt-0.5">
            Select a baseline bundle, then customize individual toggles below.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectBundle(coreKeys)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border ${
              isEssentialsSelected
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-500/50'
                : 'bg-white/10 hover:bg-white/20 border-white/10 text-slate-200'
            }`}
          >
            {isEssentialsSelected && <Check size={14} />}
            <span>Essentials Bundle</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectBundle(allKeys)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border ${
              isFullSuiteSelected
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-500/50'
                : 'bg-white/10 hover:bg-white/20 border-white/10 text-slate-200'
            }`}
          >
            <Layers size={14} />
            {isFullSuiteSelected && <Check size={14} />}
            <span>Full Suite (All Modules)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
