import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

const Register = () => {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("general");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { register, loginWithGoogle, isLoading, error } = useAuthStore();

  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const idToken = tokenResponse.access_token || tokenResponse.id_token;
      const success = await loginWithGoogle(idToken);
      if (success) {
        navigate("/general-dashboard", { replace: true });
      }
    },
    onError: (err) => {
      console.error("Google Login Error:", err);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (role === "college-admin") {
      navigate("/register");
      return;
    }
    const success = await register(name, email, password, studentId, role);
    if (success) {
      navigate("/general-dashboard", { replace: true });
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

        <div className="flex flex-col sm:flex-row gap-3">
          <motion.div variants={itemVariants} className="w-full sm:w-1/2">
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
              required
              disabled={isLoading}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              autoCapitalize="characters"
              className="w-full p-2.5 text-sm bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 placeholder-muted/50 transition-all shadow-sm disabled:opacity-50"
              placeholder="ID1001"
            />
          </motion.div>

          <motion.div variants={itemVariants} className="w-full sm:w-1/2">
            <label
              htmlFor="reg-role"
              className="block text-xs font-medium text-muted mb-1.5 ml-1"
            >
              Role
            </label>
            <select
              id="reg-role"
              name="role"
              value={role}
              disabled={isLoading}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2.5 text-sm bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember/50 transition-all appearance-none cursor-pointer shadow-sm disabled:opacity-50"
            >
              <option value="general" className="bg-deep text-ink">
                General Patron
              </option>
              <option value="college-admin" className="bg-deep text-ink">
                College Admin (Onboarding Wizard)
              </option>
            </select>
            {role === "college-admin" && (
              <p className="text-[11px] text-amber-400 mt-1">
                College Admin accounts are provisioned via Institution Tenant
                Onboarding. Submitting will open the Onboarding Wizard.
              </p>
            )}
          </motion.div>
        </div>

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
