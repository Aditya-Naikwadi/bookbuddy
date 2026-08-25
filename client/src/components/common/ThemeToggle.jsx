import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export const ThemeToggle = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      className={`p-2 rounded-xl border transition-all duration-200 flex items-center justify-center relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-ember ${
        isDark
          ? "bg-slate-800/80 text-amber-400 border-slate-700 hover:bg-slate-700"
          : "bg-amber-50 text-indigo-600 border-amber-200 hover:bg-amber-100 shadow-xs"
      } ${className}`}
    >
      <motion.div
        key={theme}
        initial={
          prefersReducedMotion
            ? { opacity: 1 }
            : { rotate: -90, scale: 0.5, opacity: 0 }
        }
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={
          prefersReducedMotion
            ? { opacity: 0 }
            : { rotate: 90, scale: 0.5, opacity: 0 }
        }
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex items-center justify-center"
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-amber-400 fill-amber-400/20" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20" />
        )}
      </motion.div>
    </motion.button>
  );
};

export default ThemeToggle;
