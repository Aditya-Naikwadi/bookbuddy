import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  Calendar,
  Clock,
  ShieldCheck,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "../../ui/Button";
import { useReducedMotion } from "../../../hooks/useReducedMotion";

export const ReservationModal = ({
  slot,
  dateLabel,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
}) => {
  const modalRef = useRef(null);
  const closeBtnRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  // Focus trap implementation
  useEffect(() => {
    if (!slot) return;

    // Focus the first element (close button) when modal opens
    setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: loop back to last
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          // Tab: loop back to first
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slot, onClose]);

  return (
    <AnimatePresence>
      {slot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-reservation-title"
        >
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
          />

          <motion.div
            ref={modalRef}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 15 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 15 }
            }
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="bg-white dark:bg-surface rounded-3xl max-w-md w-full border border-slate-200 dark:border-edge p-6 shadow-2xl relative z-10 flex flex-col font-sans text-slate-900 dark:text-ink"
          >
            {/* Screen Reader Live Alerts */}
            {errorMessage && (
              <div className="sr-only" role="alert" aria-live="assertive">
                Error: {errorMessage}
              </div>
            )}

            {/* Dismiss Button */}
            <button
              ref={closeBtnRef}
              onClick={onClose}
              disabled={isPending}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
              aria-label="Dismiss booking confirmation"
            >
              <X size={18} />
            </button>

            {/* Heading */}
            <h3
              id="confirm-reservation-title"
              className="text-xl font-serif font-black text-slate-900 dark:text-ink pr-8"
            >
              Confirm Your Workstation Reservation
            </h3>
            <p className="text-xs text-slate-500 dark:text-muted mt-1">
              Review timeslot and seat specifications before finalizing.
            </p>

            {/* Workstation summary box */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-edge rounded-2xl p-4 my-5 space-y-3.5">
              <div className="flex items-center gap-3">
                <Monitor className="text-indigo-600 dark:text-indigo-400 w-5 h-5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-muted font-extrabold uppercase tracking-wide">
                    Workstation
                  </p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {slot.seatNumber}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="text-indigo-600 dark:text-indigo-400 w-5 h-5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-muted font-extrabold uppercase tracking-wide">
                    Date
                  </p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {dateLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="text-indigo-600 dark:text-indigo-400 w-5 h-5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-muted font-extrabold uppercase tracking-wide">
                    Reserved Time & Duration
                  </p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {slot.timeLabel} (1 hour)
                  </p>
                </div>
              </div>
            </div>

            {/* Error panel if conflict occurred */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-rose-950/60 text-red-800 dark:text-rose-200 border border-red-200 dark:border-rose-800 rounded-2xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                <span className="text-red-500 shrink-0">⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Operational buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-1">
              <Button
                onClick={onClose}
                disabled={isPending}
                variant="ghost"
                className="flex-1 h-11 rounded-2xl text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-2 focus:ring-slate-400 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md hover:shadow-indigo-500/25 flex items-center justify-center gap-2 focus:ring-2 focus:ring-indigo-600 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Confirm Booking</span>
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReservationModal;
