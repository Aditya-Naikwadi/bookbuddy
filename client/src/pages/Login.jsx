import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { Loader2, Eye, EyeOff, CheckCircle2, GraduationCap, Globe, Building2, Shield, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const GithubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

const DEMO_ACCOUNTS = [
  {
    role: 'Student',
    email: 'student@bookbuddy.com',
    password: 'Demo@123',
    icon: GraduationCap,
    badge: 'Student',
    color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
  },
  {
    role: 'General',
    email: 'general@bookbuddy.com',
    password: 'Demo@123',
    icon: Globe,
    badge: 'General',
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
  },
  {
    role: 'College Admin',
    email: 'collegeadmin@bookbuddy.com',
    password: 'Demo@123',
    icon: Building2,
    badge: 'College Admin',
    color: 'border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
  },
  {
    role: 'Super Admin',
    email: 'admin@bookbuddy.com',
    password: 'Demo@123',
    icon: Shield,
    badge: 'Super Admin',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
  }
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryMsg, setShowRecoveryMsg] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error } = useAuthStore();

  const from = location.state?.from?.pathname || '/student-dashboard';

  const handleQuickLogin = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    const success = await login(demoEmail, demoPassword);
    if (success) {
      navigate(from, { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate(from, { replace: true });
    }
  };

  // Validates either format: a valid email format, or a valid student ID format (min length of 4)
  const isIdentifierValid = email.includes('@') ? (email.length > 3 && email.includes('.')) : (email.trim().length >= 4);

  const formVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.08, delayChildren: 0.1 } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
      <motion.h2 
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="text-xl font-serif font-bold text-ink mb-3 text-center"
      >
        Welcome Back
      </motion.h2>

      {/* Quick Demo Accounts Selection */}
      <motion.div 
        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-5 p-3 rounded-xl bg-surface/40 border border-edge/60 backdrop-blur-sm shadow-inner"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-wider text-muted uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-ember" /> Quick Demo Access
          </span>
          <span className="text-[10px] text-muted/80">Click to autofill & login</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acc) => {
            const Icon = acc.icon;
            return (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleQuickLogin(acc.email, acc.password)}
                title={`Login as ${acc.role} (${acc.email})`}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-xs font-medium cursor-pointer ${acc.color}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="overflow-hidden leading-tight">
                  <div className="font-semibold text-[11px] truncate">{acc.badge}</div>
                  <div className="text-[9px] opacity-75 truncate">{acc.email}</div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
      
      {error && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/20 border border-red-500/30 text-red-200 p-2.5 rounded-lg text-xs mb-5 text-center shadow-lg"
        >
          {error}
        </motion.div>
      )}

      {showRecoveryMsg && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-success/20 border border-success/30 text-success p-2.5 rounded-lg text-xs mb-5 text-center shadow-lg animate-pulse"
        >
          Please contact your college IT Helpdesk or library administrator to reset your password.
        </motion.div>
      )}

      <motion.form 
        variants={formVariants} initial="hidden" animate="visible"
        className="space-y-4" onSubmit={handleSubmit}
      >
        <motion.div variants={itemVariants} className="relative">
          <label className="block text-xs font-medium text-muted mb-1.5 ml-1">Email or Student ID</label>
          <div className="relative">
            <input
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
                  initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
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
            <label className="block text-xs font-medium text-muted">Password</label>
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
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign In'}
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
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button type="button" variant="ghost" disabled={isLoading} className="w-full flex items-center justify-center gap-2 border-edge hover:bg-surface/60 h-9">
              <GoogleIcon />
              <span className="text-xs">Google</span>
            </Button>
            <Button type="button" variant="ghost" disabled={isLoading} className="w-full flex items-center justify-center gap-2 border-edge hover:bg-surface/60 h-9">
              <GithubIcon />
              <span className="text-xs">GitHub</span>
            </Button>
          </div>
        </motion.div>
      </motion.form>
      
      <motion.p 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="mt-5 text-center text-xs text-muted"
      >
        Don't have an account? <Link to="/auth/register" className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors">Create one</Link>
      </motion.p>
    </motion.div>
  );
};

export default Login;
