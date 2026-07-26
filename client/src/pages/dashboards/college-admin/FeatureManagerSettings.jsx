import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sliders,
  Check,
  Lock,
  Sparkles,
  ArrowLeft,
  Clock,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import useAuthStore from '../../../store/authStore';
import { FEATURE_REGISTRY, FEATURE_CATEGORIES, getEnabledFeaturesList } from '../../../config/featureRegistry';

export default function FeatureManagerSettings() {
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();

  const collegeProfile = user?.collegeProfile || {
    name: user?.collegeName || 'Stanford University',
    enabledFeatures: ['catalog', 'patrons', 'loans', 'fines', 'e-resources', 'reading-lists'],
  };

  const [enabledFeatures, setEnabledFeatures] = useState(() =>
    new Set(getEnabledFeaturesList(collegeProfile.enabledFeatures))
  );

  const [pendingApprovalSet, setPendingApprovalSet] = useState(new Set(['leaderboards']));
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const handleToggle = (featId) => {
    const feat = FEATURE_REGISTRY[featId];
    if (feat?.isCore) return; // Locked core feature

    const next = new Set(enabledFeatures);
    if (next.has(featId)) {
      next.delete(featId);
      // Remove dependent features
      Object.values(FEATURE_REGISTRY).forEach((child) => {
        if (child.requires.includes(featId)) {
          next.delete(child.id);
        }
      });
    } else {
      next.add(featId);
      // Add prerequisites
      if (feat.requires) {
        feat.requires.forEach((reqId) => next.add(reqId));
      }
    }
    setEnabledFeatures(next);
  };

  const handleRequestApproval = (featId) => {
    const nextPending = new Set(pendingApprovalSet);
    if (nextPending.has(featId)) {
      nextPending.delete(featId);
    } else {
      nextPending.add(featId);
    }
    setPendingApprovalSet(nextPending);
  };

  const handleSaveSettings = () => {
    const updatedFeaturesArray = Array.from(enabledFeatures);
    const updatedProfile = {
      ...collegeProfile,
      enabledFeatures: updatedFeaturesArray,
    };

    updateUser({
      ...user,
      collegeProfile: updatedProfile,
    });

    setSaveSuccessMsg('Feature configuration saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/college-admin"
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Console</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4" />
            <span>Feature Catalog & Provisioning</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Feature Manager Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Enable or disable modular features for {collegeProfile.name}. Self-serve toggles take effect immediately on your dashboard.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all shrink-0"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Save Active Configuration</span>
        </button>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Categories & Cards */}
      {Object.values(FEATURE_CATEGORIES).map((cat) => {
        const catFeatures = Object.values(FEATURE_REGISTRY).filter((f) => f.category === cat.key);
        if (catFeatures.length === 0) return null;

        return (
          <div key={cat.key} className="space-y-4">
            <div>
              <h2 className="text-sm font-mono font-bold text-indigo-300 uppercase tracking-wider">
                {cat.label}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{cat.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catFeatures.map((feat) => {
                const isEnabled = enabledFeatures.has(feat.id);
                const isPending = pendingApprovalSet.has(feat.id);
                const IconComp = feat.icon;

                return (
                  <div
                    key={feat.id}
                    className={`p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                      feat.isCore
                        ? 'bg-slate-900/60 border-slate-800'
                        : isEnabled
                        ? 'bg-slate-900 border-indigo-500/40 shadow-lg shadow-slate-950'
                        : 'bg-slate-900/40 border-slate-800/80 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isEnabled
                            ? 'bg-indigo-600 text-white border-indigo-400'
                            : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{feat.name}</h3>
                          {feat.isCore && (
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" /> Core
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{feat.description}</p>
                      </div>
                    </div>

                    {/* Action Controls: Self-Serve vs Enterprise Pending Approval */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      {feat.isCore ? (
                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Core System Feature (Always Active)
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggle(feat.id)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                                isEnabled
                                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {isEnabled ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Enabled</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Enable Module</span>
                                </>
                              )}
                            </button>

                            {/* Request Approval Demo Toggle */}
                            <button
                              onClick={() => handleRequestApproval(feat.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-mono border transition-all ${
                                isPending
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {isPending ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-400" /> Pending Approval
                                </span>
                              ) : (
                                <span>Request Enterprise Approval</span>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
