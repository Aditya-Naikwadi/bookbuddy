import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Building2, ArrowRight, ShieldAlert, BookOpen } from "lucide-react";
import useAuthStore from "../../store/authStore";
import { FEATURE_REGISTRY } from "../../config/dashboardFeatureRegistry";

export default function CollegeDeepLinkEntry() {
  const { collegeSlug, "*": wildcardPath } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoading: authLoading } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [collegeData, setCollegeData] = useState(null);
  const [error, setError] = useState(null);

  // Normalize path suffix (e.g. "shelves", "feed", "fines")
  const featurePath = (wildcardPath || "").replace(/^\/+/, "").toLowerCase();

  useEffect(() => {
    let isMounted = true;

    async function fetchCollegeMetadata() {
      if (!collegeSlug) {
        setError("Invalid college link.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`/api/v1/colleges/by-slug/${collegeSlug}`);
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success && data.data) {
          setCollegeData(data.data);
          setError(null);
        } else {
          setError(data.message || "Institution portal not found.");
        }
      } catch {
        if (isMounted) {
          setError(
            "Failed to load college details. Please check your connection.",
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchCollegeMetadata();
    return () => {
      isMounted = false;
    };
  }, [collegeSlug]);

  // Resolve target internal route from featurePath or registry
  const getInternalRoute = useCallback(() => {
    if (!featurePath) return "/student-dashboard";

    const match = Object.values(FEATURE_REGISTRY).find(
      (entry) =>
        entry.route === `/${featurePath}` ||
        entry.route.replace(/^\/+/, "") === featurePath,
    );

    return match ? match.route : `/${featurePath}`;
  }, [featurePath]);

  // Resolve target feature label
  const getFeatureLabel = useCallback(() => {
    if (!featurePath) return "Student Dashboard";
    const match = Object.values(FEATURE_REGISTRY).find(
      (entry) =>
        entry.route === `/${featurePath}` ||
        entry.route.replace(/^\/+/, "") === featurePath,
    );
    return match ? match.label : featurePath.toUpperCase();
  }, [featurePath]);

  // Perform post-auth routing logic once auth state & collegeData are ready
  useEffect(() => {
    if (loading || authLoading || !collegeData || error) return;

    if (isAuthenticated && user) {
      const userCollegeSlug = user.collegeId?.slug || user.collegeSlug;
      const targetInternalRoute = getInternalRoute();

      // Check tenant match: compare session collegeSlug vs link collegeSlug
      const isTenantMatch =
        (userCollegeSlug &&
          userCollegeSlug.toLowerCase() === collegeSlug.toLowerCase()) ||
        (user.collegeId &&
          user.collegeId._id &&
          collegeData.collegeId &&
          String(user.collegeId._id) === String(collegeData.collegeId));

      if (isTenantMatch || user.role === "super-admin") {
        // User belongs to this college -> redirect to the feature page directly
        navigate(targetInternalRoute, { replace: true });
      } else {
        // Tenant Mismatch -> Do NOT render target college page; redirect to user's dashboard home with notice
        navigate("/student-dashboard", {
          replace: true,
          state: {
            mismatchNotice: `That link was for ${collegeData.name} — here's your dashboard.`,
          },
        });
      }
    }
  }, [
    loading,
    authLoading,
    collegeData,
    isAuthenticated,
    user,
    collegeSlug,
    navigate,
    error,
    getInternalRoute,
  ]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-medium">
          Resolving college library portal...
        </p>
      </div>
    );
  }

  if (error || !collegeData) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Link Unavailable</h1>
            <p className="text-sm text-slate-400">
              {error ||
                "The institution specified in this link could not be found."}
            </p>
          </div>
          <Link
            to="/auth/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Go to BookBuddy Login
          </Link>
        </div>
      </div>
    );
  }

  // Render branded pre-login view for unauthenticated visitors
  const targetInternalRoute = getInternalRoute();
  const featureLabel = getFeatureLabel();

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient Lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Building2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-full text-[11px] font-semibold tracking-wide uppercase">
            {collegeData.name}
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight pt-2">
            Log in to {collegeData.name} Library
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Sign in to your student account to access{" "}
            <strong className="text-slate-200">{featureLabel}</strong> directly.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/auth/login"
            state={{
              from: { pathname: targetInternalRoute },
              collegeSlug: collegeData.slug,
            }}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 group"
          >
            <span>Log In to Continue</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>BookBuddy Digital Library</span>
          </div>
          <span>Tenant Verified</span>
        </div>
      </div>
    </div>
  );
}
