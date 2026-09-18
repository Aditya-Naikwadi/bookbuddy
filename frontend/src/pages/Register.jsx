import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { useConfig } from "../context/ConfigContext";
import {
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  ChevronDown,
  Clock,
  ShieldAlert,
  ArrowRight,
  Home,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleLogin } from "@react-oauth/google";
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
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const GoogleSignUpButton = ({ isLoading, onSuccess, onError }) => {
  const triggerGoogleLogin = useGoogleLogin({
    onSuccess,
    onError,
  });

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={isLoading}
      onClick={() => triggerGoogleLogin()}
      className="w-full flex items-center justify-center gap-2 border-edge hover:bg-surface/60 h-9"
    >
      <GoogleIcon />
      <span className="text-xs">Continue with Google</span>
    </Button>
  );
};

const Register = () => {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("general");
  const [showPassword, setShowPassword] = useState(false);

  // College Student - Searchable active colleges state
  const [collegeId, setCollegeId] = useState("");
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [isLoadingColleges, setIsLoadingColleges] = useState(
    role === "college-student",
  );
  const [collegeSearch, setCollegeSearch] = useState("");
  const [isCollegeDropdownOpen, setIsCollegeDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const collegeDropdownRef = useRef(null);
  const listboxRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    if (role === "college-student" && colleges.length === 0) {
      const fetchActiveColleges = async () => {
        setIsLoadingColleges(true);
        try {
          const data = await registrationApi.getActiveColleges();
          if (isMounted) {
            setColleges(Array.isArray(data) ? data : []);
          }
        } catch (err) {
          console.error("Failed to load active colleges:", err);
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
  }, [role, colleges.length]);

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
        c.domain?.toLowerCase().includes(term)
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
    if (!college) return;
    setSelectedCollege(college);
    setCollegeId(college._id);
    setCollegeSearch("");
    setIsCollegeDropdownOpen(false);
    setHighlightedIndex(-1);
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

  const navigate = useNavigate();
  const { register, loginWithGoogle, isLoading, error } = useAuthStore();
  const { googleClientId } = useConfig();
  const isGoogleAuthAvailable = Boolean(
    googleClientId &&
    typeof googleClientId === "string" &&
    googleClientId.trim(),
  );

  const handleGoogleSuccess = async (tokenResponse) => {
    const idToken = tokenResponse.access_token || tokenResponse.id_token;
    const success = await loginWithGoogle(idToken);
    if (success) {
      navigate("/general-dashboard", { replace: true });
    }
  };

  const handleRoleChange = (newRole) => {
    if (newRole === "college-admin") {
      setRole("college-admin");
      navigate("/register");
      return;
    }
    setRole(newRole);
  };

  useEffect(() => {
    if (role === "college-admin") {
      navigate("/register", { replace: true });
    }
  }, [role, navigate]);

  const [pendingJoinRequest, setPendingJoinRequest] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (role === "college-admin") {
      navigate("/register");
      return;
    }
    const result = await register(
      name,
      email,
      password,
      studentId,
      role,
      collegeId,
    );
    if (result && typeof result === "object" && result.requiresApproval) {
      setPendingJoinRequest(result.joinRequest);
      return;
    }
    if (result) {
      if (role === "general") {
        navigate("/general-dashboard", { replace: true });
      } else {
        navigate("/student", { replace: true });
      }
    }
  };

  const getStrength = (pass) => {
    let score = 0;
    if (pass.length > 5) score += 1;
    if (pass.length > 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strength = getStrength(password);
  const strengthColor =
    strength === 0
      ? "bg-edge"
      : strength < 3
        ? "bg-red-500"
        : strength < 5
          ? "bg-amber-500"
          : "bg-success";
  const strengthWidth = `${Math.max((strength / 5) * 100, 5)}%`;

  const isEmailValid =
    email.length > 3 && email.includes("@") && email.includes(".");

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

  if (role === "college-admin") {
    return (
      <div
        data-testid="admin-redirect-state"
        className="w-full flex flex-col items-center justify-center p-8 space-y-3 text-center"
      >
        <Loader2 className="w-8 h-8 animate-spin text-ember" />
        <p className="text-sm font-medium text-ink">
          Redirecting to Institutional Tenant Onboarding...
        </p>
      </div>
    );
  }

  if (pendingJoinRequest) {
    return (
      <motion.div
        data-testid="student-pending-approval-screen"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full space-y-4 text-center py-2"
      >
        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Pending Administrator Approval
          </div>
          <h2 className="text-xl font-serif font-bold text-ink">
            Join Request Submitted
          </h2>
          <p className="text-xs text-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
            Your enrollment request for{" "}
            <span className="text-ember font-semibold">
              {pendingJoinRequest.collegeName ||
                selectedCollege?.name ||
                "your institution"}
            </span>{" "}
            has been submitted and is awaiting administrator verification.
          </p>
        </div>

        {/* Details Card */}
        <div className="bg-surface/50 border border-edge rounded-2xl p-4 text-left space-y-2.5 text-xs shadow-inner">
          <div className="flex justify-between items-center py-1 border-b border-edge/40">
            <span className="text-muted">Student ID</span>
            <span className="font-mono font-medium text-ink">
              {pendingJoinRequest.studentId || studentId}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-edge/40">
            <span className="text-muted">Registered Email</span>
            <span className="font-medium text-ink">
              {pendingJoinRequest.email || email}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-edge/40">
            <span className="text-muted">Institution</span>
            <span className="font-medium text-ink truncate max-w-[200px]">
              {pendingJoinRequest.collegeName ||
                selectedCollege?.name ||
                "Selected College"}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted">Tenant Access</span>
            <span className="font-medium text-amber-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Locked Until Approved
            </span>
          </div>
        </div>

        {/* Security & isolation notice */}
        <div className="p-3 rounded-xl bg-surface/30 border border-edge/60 text-[11px] text-muted text-left">
          <p>
            Campus library resources, book reservations, and digital collections
            require institutional clearance. You will be notified once a college
            administrator reconciles your record.
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/")}
            className="w-full flex items-center justify-center gap-2 border-edge text-xs h-9"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Home</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => navigate("/auth/login")}
            className="w-full flex items-center justify-center gap-2 text-xs h-9 bg-ember hover:bg-ember/90 text-white font-semibold shadow-md shadow-ember/20"
          >
            <span>Go to Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full"
    >
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-xl font-serif font-bold text-ink mb-4 text-center"
      >
        Create Account
      </motion.h2>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/20 border border-red-500/30 text-red-200 p-2.5 rounded-lg text-xs mb-4 text-center shadow-lg"
        >
          {error}
        </motion.div>
      )}

      <motion.form
        variants={formVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <motion.div variants={itemVariants} className="w-full sm:w-1/2">
            <label
              htmlFor="reg-name"
              className="block text-xs font-medium text-muted mb-1.5 ml-1"
            >
              Full Name
            </label>
            <input
              id="reg-name"
              name="name"
              type="text"
              required
              disabled={isLoading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              autoCapitalize="words"
              autoFocus
              className="w-full p-2.5 text-sm bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-sm disabled:opacity-50"
              placeholder="John Doe"
            />
          </motion.div>

          <motion.div variants={itemVariants} className="w-full sm:w-1/2">
            <label
              htmlFor="reg-email"
              className="block text-xs font-medium text-muted mb-1.5 ml-1"
            >
              Email
            </label>
            <div className="relative">
              <input
                id="reg-email"
                name="email"
                type="email"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                className="w-full p-2.5 pr-10 text-sm bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-sm disabled:opacity-50"
                placeholder="john@example.com"
              />
              <AnimatePresence>
                {isEmailValid && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
                  >
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    <span className="sr-only">Valid email format</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="space-y-1.5">
          <label className="block text-xs font-medium text-muted ml-1">
            Account Type
          </label>
          <div
            role="radiogroup"
            aria-label="Account Type"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
          >
            {[
              {
                id: "reg-role-general",
                value: "general",
                label: "General Patron",
              },
              {
                id: "reg-role-student",
                value: "college-student",
                label: "College Student",
              },
              {
                id: "reg-role-admin",
                value: "college-admin",
                label: "College Admin",
              },
            ].map((option) => {
              const isSelected = role === option.value;
              return (
                <label
                  key={option.value}
                  htmlFor={option.id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none ${
                    isSelected
                      ? "border-ember bg-ember/10 text-ink shadow-sm ring-1 ring-ember/30"
                      : "border-edge bg-surface/40 text-muted hover:text-ink hover:bg-surface/60 hover:border-edge/80"
                  } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="radio"
                    id={option.id}
                    name="role"
                    value={option.value}
                    checked={isSelected}
                    disabled={isLoading}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-3.5 h-3.5 text-ember border-edge focus:ring-ember/50 accent-ember cursor-pointer"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </motion.div>

        <AnimatePresence>
          {role === "college-student" && (
            <motion.div
              variants={itemVariants}
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="space-y-1.5"
            >
              <label
                htmlFor="reg-college-search"
                className="block text-xs font-medium text-muted ml-1"
              >
                Select Institution <span className="text-ember">*</span>
              </label>

              <div className="relative" ref={collegeDropdownRef}>
                <div className="relative">
                  <input
                    id="reg-college-search"
                    type="text"
                    role="combobox"
                    aria-expanded={isCollegeDropdownOpen}
                    aria-haspopup="listbox"
                    aria-controls="college-options-list"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      isCollegeDropdownOpen &&
                      highlightedIndex >= 0 &&
                      filteredColleges[highlightedIndex]
                        ? `reg-college-opt-${filteredColleges[highlightedIndex]._id}`
                        : undefined
                    }
                    aria-label="Select Institution"
                    disabled={isLoading}
                    value={
                      isCollegeDropdownOpen
                        ? collegeSearch
                        : selectedCollege
                          ? selectedCollege.name
                          : ""
                    }
                    onChange={(e) => {
                      setCollegeSearch(e.target.value);
                      if (!isCollegeDropdownOpen)
                        setIsCollegeDropdownOpen(true);
                      setHighlightedIndex(-1);
                    }}
                    onFocus={() => {
                      setIsCollegeDropdownOpen(true);
                      setCollegeSearch("");
                      setHighlightedIndex(-1);
                    }}
                    onKeyDown={handleCollegeKeyDown}
                    placeholder={
                      isLoadingColleges
                        ? "Loading active institutions..."
                        : selectedCollege
                          ? selectedCollege.name
                          : "Search active institutions..."
                    }
                    className="w-full p-2.5 pl-9 pr-9 text-sm bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-sm"
                  />
                  <Building2 className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {isLoadingColleges ? (
                      <Loader2 className="w-4 h-4 text-muted animate-spin" />
                    ) : (
                      <ChevronDown
                        className={`w-4 h-4 text-muted cursor-pointer transition-transform duration-200 ${
                          isCollegeDropdownOpen ? "rotate-180 text-ember" : ""
                        }`}
                        onClick={() => {
                          setIsCollegeDropdownOpen(!isCollegeDropdownOpen);
                          setHighlightedIndex(-1);
                        }}
                      />
                    )}
                  </div>
                </div>

                {isCollegeDropdownOpen && (
                  <div
                    id="college-options-list"
                    ref={listboxRef}
                    role="listbox"
                    aria-label="Active institutions"
                    className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-deep/95 backdrop-blur-md border border-edge rounded-xl shadow-xl py-1 text-xs divide-y divide-edge/30"
                  >
                    {filteredColleges.length > 0 ? (
                      filteredColleges.map((college, index) => {
                        const isChosen = selectedCollege?._id === college._id;
                        const isHighlighted = highlightedIndex === index;
                        const optId = `reg-college-opt-${college._id}`;
                        return (
                          <div
                            key={college._id}
                            id={optId}
                            data-index={index}
                            role="option"
                            aria-selected={isChosen || isHighlighted}
                            onClick={() => handleSelectCollege(college)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isChosen
                                ? "bg-ember/15 text-ember font-semibold"
                                : isHighlighted
                                  ? "bg-surface/90 text-ember border-l-2 border-ember font-medium"
                                  : "hover:bg-surface/80 text-ink"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-xs text-ink">
                                {college.name}
                              </span>
                              {(college.code || college.domain) && (
                                <span className="text-[10px] text-muted font-mono">
                                  {college.code ? `[${college.code}]` : ""}{" "}
                                  {college.domain ? `@${college.domain}` : ""}
                                </span>
                              )}
                            </div>
                            {isChosen && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-ember shrink-0" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-3 py-3 text-center text-muted text-xs">
                        {isLoadingColleges
                          ? "Loading active institutions..."
                          : "No active colleges match your search."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={itemVariants}>
          <label
            htmlFor="reg-student-id"
            className="block text-xs font-medium text-muted mb-1.5 ml-1"
          >
            ID Number
          </label>
          <input
            id="reg-student-id"
            name="studentId"
            type="text"
            required={role === "college-student"}
            disabled={isLoading}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            autoCapitalize="characters"
            className="w-full p-2.5 text-sm bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-sm disabled:opacity-50"
            placeholder={role === "college-student" ? "STU1001" : "ID1001"}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <label
            htmlFor="reg-password"
            className="block text-xs font-medium text-muted mb-1.5 ml-1"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="reg-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full p-2.5 pr-10 text-sm bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-sm disabled:opacity-50"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {/* Password Strength Meter */}
          <div className="mt-1.5 h-1 w-full bg-edge rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${strengthColor}`}
              initial={{ width: "0%" }}
              animate={{ width: strengthWidth }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="pt-2">
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full text-sm h-10 shadow-[0_0_15px_rgba(230,101,37,0.2)] hover:shadow-[0_0_25px_rgba(230,101,37,0.4)] transition-shadow"
            variant="primary"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              "Create Account"
            )}
          </Button>
        </motion.div>

        {isGoogleAuthAvailable && (
          <motion.div variants={itemVariants} className="pt-2">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-edge"></div>
              </div>
              <div className="relative bg-deep/40 px-3 text-[10px] uppercase tracking-wider text-muted backdrop-blur-md">
                Or continue with
              </div>
            </div>

            <div className="mt-3">
              <GoogleSignUpButton
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
        className="mt-4 text-center text-xs text-muted"
      >
        Already have an account?{" "}
        <Link
          to="/auth/login"
          className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors"
        >
          Sign In
        </Link>
      </motion.p>
    </motion.div>
  );
};

export default Register;
