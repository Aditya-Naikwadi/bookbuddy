import { useEffect, useRef, useState } from "react";
import { ShieldAlert, X, Trash2 } from "lucide-react";
import { Button } from "../../ui/Button";

export const CancelModal = ({ booking, isPending, onConfirm, onClose }) => {
  const modalRef = useRef(null);
  const closeBtnRef = useRef(null);
  const [renderedAt] = useState(() => Date.now());

  // Focus trap
  useEffect(() => {
    if (!booking) return;

    setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);
  }, [booking]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [booking, onClose]);

  if (!booking) return null;

  const slotStartTime = booking.slotStart || booking.startTime;
  const noticeMinutes = slotStartTime
    ? Math.round((new Date(slotStartTime).getTime() - renderedAt) / (60 * 1000))
    : null;
  const isFreeCancellation = noticeMinutes === null || noticeMinutes >= 60;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-[1px] animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-booking-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col"
      >
        <button
          ref={closeBtnRef}
          onClick={onClose}
          disabled={isPending}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shrink-0 mb-4">
          <ShieldAlert size={24} />
        </div>

        <h3
          id="cancel-booking-title"
          className="text-lg font-serif font-black text-slate-900"
        >
          Cancel Reservation?
        </h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Are you sure you want to cancel your reservation for{" "}
          <strong className="text-slate-800">
            {booking.seatId?.seatNumber ||
              booking.resourceLabel ||
              "Facility Slot"}
          </strong>
          ? This slot will immediately return to the bookable pool or be offered
          to the waitlist.
        </p>

        {/* Cancellation Notice & Quota Impact Banner (§10.5) */}
        {isFreeCancellation ? (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
            <span className="text-emerald-600 font-bold shrink-0">✓</span>
            <p className="leading-normal">
              <strong>Free cancellation (≥ 1h notice):</strong> Your weekly
              quota minutes will be 100% refunded.
            </p>
          </div>
        ) : (
          <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <span className="text-amber-600 font-bold shrink-0">⚠</span>
            <p className="leading-normal">
              <strong>Late cancellation (&lt; 1h notice):</strong> Per fairness
              policy, the slot duration remains deducted from your weekly cap.
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button
            onClick={onClose}
            disabled={isPending}
            variant="ghost"
            className="flex-1 h-10 rounded-2xl text-slate-600 border border-slate-200 hover:bg-slate-50 focus:ring-2 focus:ring-slate-400"
          >
            Go Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 h-10 rounded-2xl bg-danger hover:bg-red-600 text-white font-bold shadow-md hover:shadow-red-500/25 flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-red-500"
          >
            {isPending ? (
              "Cancelling..."
            ) : (
              <>
                <Trash2 size={15} />
                <span>Yes, Cancel</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CancelModal;
