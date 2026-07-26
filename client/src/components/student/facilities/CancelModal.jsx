import { useEffect, useRef } from "react";
import { ShieldAlert, X, Trash2 } from "lucide-react";
import { Button } from "../../ui/Button";

export const CancelModal = ({ booking, isPending, onConfirm, onClose }) => {
  const modalRef = useRef(null);
  const closeBtnRef = useRef(null);

  // Focus trap
  useEffect(() => {
    if (!booking) return;

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
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [booking, onClose]);

  if (!booking) return null;

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
          Cancel Workstation Booking?
        </h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          Are you sure you want to cancel your reservation for workstation{" "}
          <strong className="text-slate-800">
            {booking.seatId?.seatNumber || "PC"}
          </strong>
          ? This slot will immediately return to the available booking pool.
        </p>

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
