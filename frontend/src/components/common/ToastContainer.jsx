import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";
import useToastStore from "../../store/toastStore";

const TOAST_VARIANTS = {
  success: {
    bg: "bg-emerald-950/90 dark:bg-emerald-950/90 border-emerald-500/40 text-emerald-100",
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
    barColor: "bg-emerald-500",
  },
  error: {
    bg: "bg-rose-950/90 dark:bg-rose-950/90 border-rose-500/40 text-rose-100",
    icon: XCircle,
    iconColor: "text-rose-400",
    barColor: "bg-rose-500",
  },
  warning: {
    bg: "bg-amber-950/90 dark:bg-amber-950/90 border-amber-500/40 text-amber-100",
    icon: AlertCircle,
    iconColor: "text-amber-400",
    barColor: "bg-amber-500",
  },
  info: {
    bg: "bg-slate-900/90 dark:bg-slate-900/90 border-indigo-500/40 text-slate-100",
    icon: Info,
    iconColor: "text-indigo-400",
    barColor: "bg-indigo-500",
  },
};

const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence mode="sync">
        {toasts.map((toastItem) => {
          const config = TOAST_VARIANTS[toastItem.type] || TOAST_VARIANTS.info;
          const Icon = config.icon;

          return (
            <motion.div
              key={toastItem.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all ${config.bg}`}
              role="alert"
            >
              <div className="flex items-start gap-3">
                <Icon
                  size={20}
                  className={`mt-0.5 shrink-0 ${config.iconColor}`}
                />
                <div className="flex-1 pr-2">
                  <h4 className="font-bold text-xs leading-tight tracking-wide">
                    {toastItem.title}
                  </h4>
                  {toastItem.message && (
                    <p className="mt-1 text-[11px] opacity-85 leading-relaxed font-normal">
                      {toastItem.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toastItem.id)}
                  className="rounded-lg p-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
                  aria-label="Close notification"
                >
                  <X size={14} />
                </button>
              </div>

              {toastItem.duration > 0 && (
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{
                    duration: toastItem.duration / 1000,
                    ease: "linear",
                  }}
                  className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left ${config.barColor}`}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
