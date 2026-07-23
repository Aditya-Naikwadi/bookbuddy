import { useEffect, useRef, useCallback } from 'react';
import { X, Smartphone, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const EnlargeModal = ({ isOpen, onClose, studentId, name, triggerRef }) => {
  const modalRef = useRef(null);

  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    return Array.from(
      modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  const handleTabKey = useCallback(
    (e) => {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    },
    [getFocusableElements]
  );

  useEffect(() => {
    if (isOpen) {
      // Focus modal close button or header
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        setTimeout(() => focusable[0].focus(), 50);
      }

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
        if (e.key === 'Tab') {
          handleTabKey(e);
        }
      };

      const triggerEl = triggerRef?.current;
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        // Focus return to trigger button
        if (triggerEl) {
          triggerEl.focus();
        }
      };
    }
  }, [isOpen, onClose, getFocusableElements, handleTabKey, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-white animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enlarge-title"
    >
      {/* Top Header controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-slate-900 border-b border-slate-100 pb-3">
        <h3 id="enlarge-title" className="text-base font-black flex items-center gap-2">
          <Smartphone className="text-ember" size={18} />
          Enlarged for Checkout Scanning
        </h3>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-900 transition-colors focus:ring-2 focus:ring-ember"
          aria-label="Close enlarged scan card"
        >
          <X size={24} />
        </button>
      </div>

      {/* Centered Large QR Code */}
      <div className="flex flex-col items-center justify-center space-y-6 max-w-sm w-full text-center">
        <div
          className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 flex items-center justify-center"
          role="img"
          aria-label={`Verification QR code representing Student Card ID: ${studentId}`}
        >
          <QRCodeSVG
            value={studentId}
            size={220}
            level="H"
            includeMargin={false}
            fgColor="#06080d"
            bgColor="#ffffff"
          />
        </div>

        {/* Massive ID text */}
        <div className="space-y-1">
          <p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Student Card ID</p>
          <p className="text-3xl font-mono font-black text-slate-950 select-all">{studentId}</p>
          <p className="text-sm font-bold text-slate-700 truncate max-w-[280px]">{name}</p>
        </div>

        {/* Help Banner */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>
            Present this screen directly to the desk scanner. If the scanner fails, the librarian can key in the ID printed above.
          </p>
        </div>
      </div>
    </div>
  );
};
