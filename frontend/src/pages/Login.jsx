import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { useConfig } from "../context/ConfigContext";
import { isUserAllowedForRoute } from "../config/roleRouteConfig";
import {
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  Search,
  ChevronDown,
  X,
  School,
  ArrowRight,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleLogin } from "@react-oauth/google";
import { getSubdomainTenantSlug } from "../utils/tenantSubdomain";
import { registrationApi } from "../api/registrationApi";

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

function GoogleSignInButton({ isAvailable, onSuccess, onError }) {
  const loginWithGoogleOAuth = useGoogleLogin({
    onSuccess,
    onError,
  });

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!isAvailable}
      onClick={() => loginWithGoogleOAuth()}
      className="w-full h-11 border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { googleClientId } = useConfig();
  const { login, loginWithGoogle, isLoading, error, mfaRequired } =
    useAuthStore();
  const isGoogleAuthAvailable = Boolean(
    googleClientId &&
    typeof googleClientId === "string" &&
    googleClientId.trim(),
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showMfaField, setShowMfaField] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [redirectingMsg, setRedirectingMsg] = useState(null);
  const [showRecoveryMsg, setShowRecoveryMsg] = useState(false);

  const handlePostAuthNavigate = () => {
    const user = useAuthStore.getState().user;
    let defaultRoute = "/student";
    let collegeName =
      user?.collegeId?.name || user?.collegeName || "your institution";

    if (
      ["college-admin", "college_admin", "admin", "librarian"].includes(
        user?.role,
      )
    ) {
      defaultRoute = "/college-admin";
    } else if (user?.role === "general") {
      defaultRoute = "/general-dashboard";
    } else if (user?.role === "super-admin" || user?.role === "super_admin") {
      defaultRoute = "/admin-portal";
    }

    const savedPath = location.state?.from?.pathname;
    const targetPath =
      savedPath && isUserAllowedForRoute(user, savedPath)
        ? savedPath
        : defaultRoute;

    const isSuper =
      user?.role === "super-admin" || user?.role === "super_admin";
    // Show transition overlay for 1.2s to orient student/user to their portal
    setRedirectingMsg(
      isSuper
        ? "Taking you to Super Admin Portal..."
        : `Taking you to ${collegeName}'s library...`,
    );
    setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 1200);
  };

  const subdomainSlug = getSubdomainTenantSlug();
  const isCentralLogin = !subdomainSlug;
  // Strictly isolate tenant login: on root domain, no parallel tenant resolution
  const effectiveCollegeSlug = subdomainSlug;

  // Searchable College Picker states for Central Login (active colleges only)
  const [colleges, setColleges] = useState([]);
  const [isLoadingColleges, setIsLoadingColleges] = useState(
    Boolean(isCentralLogin),
  );
  const [collegeSearch, setCollegeSearch] = useState("");
  const [isCollegeDropdownOpen, setIsCollegeDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const collegeDropdownRef = useRef(null);
  const listboxRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    if (isCentralLogin && colleges.length === 0) {
      const fetchActiveColleges = async () => {
        setIsLoadingColleges(true);
        try {
          const data = await registrationApi.getActiveColleges();
          if (isMounted) {
            setColleges(Array.isArray(data) ? data : []);
          }
        } catch (err) {
          console.error(
            "Failed to load active colleges for login picker:",
            err,
          );
        } finally {
          if (isMounted) {
            setIsLoadingColleges(false);
          }
        }
      };

      fetchActiveColleges();
    }
    return () => {
      isMounted = false;
    };
  }, [isCentralLogin, colleges.length]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        collegeDropdownRef.current &&
        !collegeDropdownRef.current.contains(e.target)
      ) {
        setIsCollegeDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredColleges = useMemo(() => {
    const term = collegeSearch.toLowerCase().trim();
    if (!term) return colleges;
    return colleges.filter((c) => {
      return (
        c.name?.toLowerCase().includes(term) ||
        c.shortName?.toLowerCase().includes(term) ||
        c.code?.toLowerCase().includes(term) ||
        c.domain?.toLowerCase().includes(term) ||
        c.slug?.toLowerCase().includes(term)
      );
    });
  }, [colleges, collegeSearch]);

  // Auto-scroll highlighted combobox option into view
  useEffect(() => {
    if (isCollegeDropdownOpen && highlightedIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`,
      );
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isCollegeDropdownOpen]);

  const handleSelectCollege = (college) => {
    if (!college || !college.slug) return;
    setIsCollegeDropdownOpen(false);
    setHighlightedIndex(-1);
    const targetUrl = `https://${college.slug}.bookbuddy.com/login`;
    setRedirectingMsg(
      `Redirecting to ${college.name} portal (${college.slug}.bookbuddy.com)...`,
    );
    if (typeof window !== "undefined") {
      window.location.assign(targetUrl);
    }
  };

  const handleCollegeKeyDown = (e) => {
    if (isLoadingColleges) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isCollegeDropdownOpen) {
        setIsCollegeDropdownOpen(true);
        setHighlightedIndex(filteredColleges.length > 0 ? 0 : -1);
      } else if (filteredColleges.length > 0) {
        setHighlightedIndex((prev) =>
          prev < filteredColleges.length - 1 ? prev + 1 : 0,
        );
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isCollegeDropdownOpen) {
        setIsCollegeDropdownOpen(true);
        setHighlightedIndex(
          filteredColleges.length > 0 ? filteredColleges.length - 1 : -1,
        );
      } else if (filteredColleges.length > 0) {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredColleges.length - 1,
        );
      }
    } else if (e.key === "Enter") {
      if (
        isCollegeDropdownOpen &&
        highlightedIndex >= 0 &&
        filteredColleges[highlightedIndex]
      ) {
        e.preventDefault();
        handleSelectCollege(filteredColleges[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      if (isCollegeDropdownOpen) {
        e.preventDefault();
        setIsCollegeDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await login(
      email,
      password,
      showMfaField || mfaRequired ? totpCode : null,
      effectiveCollegeSlug,
    );
    if (result === true) {
      handlePostAuthNavigate();
    } else if (result?.mfaRequired) {
      setShowMfaField(true);
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    const idToken = tokenResponse.access_token || tokenResponse.id_token;
    const success = await loginWithGoogle(idToken);
    if (success) {
      handlePostAuthNavigate();
    }
  };

  // Validates either format: a valid email format, or a valid student ID format (min length of 4)
  const isIdentifierValid = email.includes("@")
    ? email.length > 3 && email.includes(".")
    : email.trim().length >= 4;

  const formVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full"
    >
      {redirectingMsg && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h3 className="text-base font-bold text-white font-serif">
              {redirectingMsg}
            </h3>
            <p className="text-xs text-slate-400">
              Loading your scoped digital library dashboard...
            </p>
          </div>
        </div>
      )}

      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xl font-serif font-bold text-ink mb-3 text-center"
      >
        Welcome Back
      </motion.h2>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/20 border border-red-500/30 text-red-200 p-2.5 rounded-lg text-xs mb-5 text-center shadow-lg"
        >
          {error}
        </motion.div>
      )}

      {showRecoveryMsg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-success/20 border border-success/30 text-success p-2.5 rounded-lg text-xs mb-5 text-center shadow-lg animate-pulse"
        >
          Please contact your college IT Helpdesk or library administrator to
          reset your password.
        </motion.div>
      )}

      {/* Central Login: Searchable College Picker with Instant Redirection */}
      {isCentralLogin && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-surface/60 border border-edge/80 rounded-2xl shadow-lg backdrop-blur-sm relative"
          ref={collegeDropdownRef}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-1.5 rounded-lg bg-ember/10 text-ember border border-ember/20 shrink-0">
              <School className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink">
                Student or Faculty Member?
              </h3>
              <p className="text-[11px] text-muted">
                Find your institution to sign in to your campus library
              </p>
            </div>
          </div>

          <div className="relative mt-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="college-search-picker"
                type="text"
                role="combobox"
                aria-expanded={isCollegeDropdownOpen}
                aria-haspopup="listbox"
                aria-controls="college-picker-options"
                aria-autocomplete="list"
                aria-activedescendant={
                  isCollegeDropdownOpen &&
                  highlightedIndex >= 0 &&
                  filteredColleges[highlightedIndex]
                    ? `login-college-opt-${filteredColleges[highlightedIndex]._id || filteredColleges[highlightedIndex].slug}`
                    : undefined
                }
                aria-label="Search college institution"
                value={collegeSearch}
                onChange={(e) => {
                  setCollegeSearch(e.target.value);
                  setIsCollegeDropdownOpen(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={() => {
                  setIsCollegeDropdownOpen(true);
                  setHighlightedIndex(-1);
                }}
                onKeyDown={handleCollegeKeyDown}
                placeholder={
                  isLoadingColleges
                    ? "Loading partner institutions..."
                    : "Search active colleges (e.g. MIT, Stanford)..."
                }
                disabled={isLoadingColleges}
                autoComplete="off"
                className="w-full pl-9 pr-16 py-2.5 text-xs bg-surface/80 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-inner"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isLoadingColleges ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
                ) : (
                  <>
                    {collegeSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setCollegeSearch("");
                          setHighlightedIndex(-1);
                        }}
                        className="p-1 text-muted hover:text-ink transition-colors"
                        aria-label="Clear college search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCollegeDropdownOpen((prev) => !prev);
                        setHighlightedIndex(-1);
                      }}
                      className="p-1 text-muted hover:text-ink transition-colors"
                      aria-label="Toggle college list"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isCollegeDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </>
                )}
              </div>
            </div>

            <AnimatePresence>
              {isCollegeDropdownOpen && !isLoadingColleges && (
                <motion.div
                  id="college-picker-options"
                  ref={listboxRef}
                  role="listbox"
                  aria-label="Partner institutions"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl divide-y divide-slate-800/60"
                >
                  {filteredColleges.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted">
                      No active institutions found matching "{collegeSearch}".
                    </div>
                  ) : (
                    filteredColleges.map((college, index) => {
                      const isHighlighted = highlightedIndex === index;
                      const optId = `login-college-opt-${college._id || college.slug}`;
                      return (
                        <button
                          key={college._id || college.slug}
                          id={optId}
                          data-index={index}
                          role="option"
                          aria-selected={isHighlighted}
                          type="button"
                          onClick={() => handleSelectCollege(college)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={`w-full text-left p-2.5 transition-all group flex items-center justify-between gap-3 focus:outline-none ${
                            isHighlighted
                              ? "bg-ember/20 border-l-2 border-ember text-ember"
                              : "hover:bg-ember/10 hover:border-l-2 hover:border-ember"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-medium transition-colors truncate ${
                                  isHighlighted
                                    ? "text-ember"
                                    : "text-slate-100 group-hover:text-ember"
                                }`}
                              >
                                {college.name}
                              </span>
                              {(college.shortName || college.code) && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 shrink-0 border border-slate-700">
                                  {college.shortName || college.code}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <span className="text-indigo-400 font-sans">
                                {college.slug}.bookbuddy.com
                              </span>
                              {college.domain && (
                                <span className="text-slate-500 truncate">
                                  • {college.domain}
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className={`flex items-center gap-1 text-[11px] text-ember font-medium transition-opacity shrink-0 ${
                              isHighlighted
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            <span>Go</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative mt-5 mb-1 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-edge/60"></div>
            </div>
            <div className="relative bg-slate-950/80 px-3 text-[10px] uppercase tracking-wider text-muted font-medium rounded-full">
              Or General / Admin Sign In
            </div>
          </div>
        </motion.div>
      )}

      {effectiveCollegeSlug && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center gap-2 text-xs text-indigo-300 font-mono shadow-sm"
        >
          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            Institution Scoped:{" "}
            <strong className="text-white uppercase">
              {effectiveCollegeSlug}
            </strong>
          </span>
        </motion.div>
      )}

      <motion.form
        variants={formVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
        onSubmit={handleSubmit}
        autoComplete="off"
      >
        <motion.div variants={itemVariants} className="relative">
          <label
            htmlFor="login-username"
            className="block text-xs font-medium text-muted mb-1.5 ml-1"
          >
            Email or Student ID
          </label>
          <div className="relative">
            <input
              id="login-username"
              name="username"
              type="text"
              required
              disabled={isLoading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              className="w-full p-2.5 pr-10 text-sm bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-sm disabled:opacity-50"
              placeholder="student@bookbuddy.com"
            />
            <AnimatePresence>
              {isIdentifierValid && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
                >
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  <span className="sr-only">Valid input format</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-1.5 mx-1">
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-muted"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowRecoveryMsg(true)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full p-3.5 pr-10 bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-sm disabled:opacity-50"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </motion.div>

        {(showMfaField || mfaRequired) && (
          <motion.div variants={itemVariants}>
            <label
              htmlFor="login-mfa-code"
              className="block text-xs font-medium text-amber-400 mb-1.5 ml-1"
            >
              6-Digit Authenticator Code (MFA)
            </label>
            <input
              id="login-mfa-code"
              name="totpCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              disabled={isLoading}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              autoComplete="one-time-code"
              autoFocus
              className="w-full p-3.5 bg-surface/50 border border-amber-500/40 text-center font-mono tracking-widest text-lg rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder-muted/50 transition-all shadow-sm disabled:opacity-50"
              placeholder="123456"
            />
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="pt-2">
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 text-sm shadow-[0_0_15px_rgba(230,101,37,0.2)] hover:shadow-[0_0_25px_rgba(230,101,37,0.4)] transition-shadow"
            variant="primary"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              "Sign In"
            )}
          </Button>
        </motion.div>

        {isGoogleAuthAvailable && (
          <motion.div variants={itemVariants} className="pt-4">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-edge"></div>
              </div>
              <div className="relative bg-deep/40 px-3 text-[10px] uppercase tracking-wider text-muted backdrop-blur-md">
                Or continue with
              </div>
            </div>

            <div className="mt-4">
              <GoogleSignInButton
                isLoading={isLoading}
                onSuccess={handleGoogleSuccess}
                onError={(err) => console.error("Google Login Error:", err)}
              />
            </div>
          </motion.div>
        )}
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-5 text-center text-xs text-muted"
      >
        Don't have an account?{" "}
        <Link
          to="/auth/register"
          className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors"
        >
          Create one
        </Link>
      </motion.p>
    </motion.div>
  );
}
