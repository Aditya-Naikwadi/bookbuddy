import { Outlet, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const AuthLayout = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen grid place-items-center bg-void relative overflow-x-hidden overflow-y-auto font-sans py-8 sm:py-12">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-indigo-500/20 via-fuchsia-500/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[420px] z-10 relative m-4 flex flex-col items-center">
        <div className="text-center mb-5">
          <Link
            to="/"
            className="inline-block transition-transform hover:scale-105"
          >
            <h1 className="text-3xl font-serif font-bold text-gradient-primary mb-1">
              BookBuddy
            </h1>
          </Link>
          <p className="text-muted text-xs tracking-wide">
            Student Library Dashboard
          </p>
        </div>

        <div className="w-full p-6 sm:p-8 glass-panel bg-deep/60 backdrop-blur-2xl border border-edge rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
