import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sliders,
  Check,
  Lock,
  ArrowLeft,
  Clock,
  Plus,
  CheckCircle2,
  Share2,
  Copy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import featureApi from "../../../api/featureApi";
import {
  FEATURE_REGISTRY as CATALOG_REGISTRY,
  FEATURE_CATEGORIES,
  getEnabledFeaturesList,
} from "../../../config/featureRegistry";
import { FEATURE_REGISTRY as DASHBOARD_PAGE_REGISTRY } from "../../../config/dashboardFeatureRegistry";

export default function FeatureManagerSettings() {
  const { user } = useAuthStore();
  const [copiedKey, setCopiedKey] = useState(null);

  const { data: configData } = useQuery({
    queryKey: ["myCollegeConfig", user?.collegeId],
    queryFn: () => featureApi.getCollegeFeatures(),
    enabled: !!user,
  });

  const rawFeatures = configData?.enabledFeatures ||
    user?.collegeProfile?.enabledFeatures || [
      "catalog",
      "patrons",
      "loans",
      "fines",
      "e-resources",
      "reading-lists",
    ];

  const collegeProfile = {
    name:
      configData?.college?.name ||
      user?.collegeProfile?.name ||
      user?.collegeName ||
      "Institution Admin",
    enabledFeatures: rawFeatures,
  };

  const collegeSlug =
    configData?.college?.slug ||
    user?.collegeId?.slug ||
    user?.collegeProfile?.slug ||
    "my-college";

  const [enabledFeatures, setEnabledFeatures] = useState(
    () => new Set(getEnabledFeaturesList(collegeProfile.enabledFeatures)),
  );
  const [prevConfigData, setPrevConfigData] = useState(configData);

  if (configData !== prevConfigData) {
    setPrevConfigData(configData);
    if (configData?.enabledFeatures) {
      setEnabledFeatures(
        new Set(getEnabledFeaturesList(configData.enabledFeatures)),
      );
    }
  }

  const [pendingApprovalSet, setPendingApprovalSet] = useState(
    new Set(["leaderboards"]),
  );
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  const handleToggle = (featId) => {
    const feat = CATALOG_REGISTRY[featId];
    if (feat?.isCore) return;

    const next = new Set(enabledFeatures);
    if (next.has(featId)) {
      next.delete(featId);
      Object.values(CATALOG_REGISTRY).forEach((child) => {
        if (child.requires.includes(featId)) {
          next.delete(child.id);
        }
      });
    } else {
      next.add(featId);
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

  const handleSave = async () => {
    try {
      await featureApi.updateCollegeFeatures(Array.from(enabledFeatures));
      setSaveSuccessMsg("Feature configuration saved!");
      setTimeout(() => setSaveSuccessMsg(""), 4000);
    } catch {
      setSaveSuccessMsg("Failed to save changes.");
    }
  };

  const handleCopyLink = (url, key) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const activeFeatureArray = Array.from(enabledFeatures);
  const shareableLinksMap = new Map();

  activeFeatureArray.forEach((featKey) => {
    const registryEntry = DASHBOARD_PAGE_REGISTRY[featKey];
    if (registryEntry && registryEntry.type === "page") {
      shareableLinksMap.set(registryEntry.route, {
        key: featKey,
        label: registryEntry.label,
        route: registryEntry.route,
      });
    }
  });

  const shareableLinks = Array.from(shareableLinksMap.values());

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link
              to="/college-admin"
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Library Configuration
              </h1>
              <p className="text-xs text-slate-400">
                Self-serve feature flags & module activation for{" "}
                {collegeProfile.name}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccessMsg && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> {saveSuccessMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {FEATURE_CATEGORIES.map((cat) => {
        const catFeatures = Object.values(CATALOG_REGISTRY).filter(
          (f) => f.category === cat.id,
        );

        return (
          <div key={cat.id} className="space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h2 className="text-base font-bold text-white">{cat.name}</h2>
              <p className="text-xs text-slate-400">{cat.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catFeatures.map((feat) => {
                const isEnabled = enabledFeatures.has(feat.id);
                const isPending = pendingApprovalSet.has(feat.id);
                const IconComp = feat.icon || Sliders;

                return (
                  <div
                    key={feat.id}
                    className={`p-5 rounded-2xl border transition-all space-y-4 ${
                      isEnabled
                        ? "bg-slate-900/90 border-slate-700/80 shadow-lg"
                        : "bg-slate-950/60 border-slate-800/60 opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-xl border shrink-0 ${
                          isEnabled
                            ? "bg-indigo-600 text-white border-indigo-400"
                            : "bg-slate-800 text-slate-500 border-slate-700"
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white">
                          {feat.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      {feat.isCore ? (
                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Core System Feature
                          (Always Active)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(feat.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isEnabled
                                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
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

                          <button
                            onClick={() => handleRequestApproval(feat.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
                              isPending
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {isPending ? (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-400" />{" "}
                                Pending Approval
                              </span>
                            ) : (
                              <span>Request Enterprise Approval</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">
                Shareable Branded Feature Links
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Direct URLs branded with your college slug ({collegeSlug}) for
              campus flyers, newsletters, and QR codes.
            </p>
          </div>
          <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full">
            Live Derived
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300">
                  Student Dashboard Entry
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  General
                </span>
              </div>
              <p className="text-xs font-mono text-slate-300 mt-2 truncate">
                {`${window.location.origin}/c/${collegeSlug}`}
              </p>
            </div>
            <button
              onClick={() =>
                handleCopyLink(
                  `${window.location.origin}/c/${collegeSlug}`,
                  "general",
                )
              }
              className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copiedKey === "general" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Shareable Link</span>
                </>
              )}
            </button>
          </div>

          {shareableLinks.map(({ key, label, route }) => {
            const cleanPath = route.replace(/^\/+/, "");
            const fullUrl = `${window.location.origin}/c/${collegeSlug}/${cleanPath}`;
            const isCopied = copiedKey === key;

            return (
              <div
                key={key}
                className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {label}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      Active Feature
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 mt-2 truncate">
                    {fullUrl}
                  </p>
                </div>
                <button
                  onClick={() => handleCopyLink(fullUrl, key)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Feature Link</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
