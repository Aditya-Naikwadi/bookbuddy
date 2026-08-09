import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleLogin } from "@react-oauth/google";

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

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryMsg, setShowRecoveryMsg] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, isLoading, error } = useAuthStore();

  const [redirectingMsg, setRedirectingMsg] = useState(null);

  const handlePostAuthNavigate = () => {
    const user = useAuthStore.getState().user;
    let defaultRoute = "/student-dashboard";
    let collegeName = user?.collegeName || "your institution";

    if (user?.role === "college-admin") defaultRoute = "/college-admin";
    else if (user?.role === "general") defaultRoute = "/general-dashboard";
    else if (user?.role === "super-admin") defaultRoute = "/admin-portal";

    const targetPath = location.state?.from?.pathname || defaultRoute;

    // Show transition overlay for 1.2s to orient student/user to their college portal
    setRedirectingMsg(`Taking you to ${collegeName}'s library...`);
    setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 1200);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      handlePostAuthNavigate();
    }
  };

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const idToken = tokenResponse.access_token || tokenResponse.id_token;
      const success = await loginWithGoogle(idToken);
      if (success) {
        handlePostAuthNavigate();
      }
    },
    onError: (err) => {
      console.error("Google Login Error:", err);
    },
  });

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

      <motion.form
        variants={formVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        <motion.div variants={itemVariants} className="relative">
          <label htmlFor="login-username" className="block text-xs font-medium text-muted mb-1.5 ml-1">
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
              autoComplete="username"
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
            <label htmlFor="login-password" className="block text-xs font-medium text-muted">
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
              autoComplete="current-password"
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
          </div>
        </motion.div>
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
};

export default Login;
