import { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, CreditCard, Loader2, Receipt } from 'lucide-react';
import { Button } from '../../ui/Button';

export const PaymentDialog = ({ isOpen, onClose, triggerRef, fineItem, allFines, totalAmount, onConfirm, isProcessing }) => {
  const dialogRef = useRef(null);
  const [step, setStep] = useState('confirm'); // 'confirm' | 'paying' | 'success'
  const [paymentRef, setPaymentRef] = useState('');

  // Handle focus return and Escape key
  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      // Trap focus: focus the close button or first input first
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        // Delay slightly for render cycles
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

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        // Return focus to triggering button
        if (triggerRef?.current) {
          triggerRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  const getFocusableElements = () => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  };

  const handleTabKey = (e) => {
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
  };

  const handlePay = async () => {
    setStep('paying');
    try {
      await onConfirm();
      setPaymentRef(`PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setStep('success');
    } catch (err) {
      setStep('confirm');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md overflow-hidden border border-edge/30 rounded-2xl bg-surface shadow-2xl glass-panel animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-edge/20">
          <h3 id="dialog-title" className="text-lg font-bold text-ink flex items-center gap-2">
            <Receipt className="text-ember" size={20} />
            {step === 'success' ? 'Payment Receipt' : 'Confirm Fine Payment'}
          </h3>
          {step !== 'paying' && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-muted hover:text-ink hover:bg-edge/40 transition-colors focus:ring-2 focus:ring-ember"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'confirm' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Please review and confirm the fine payment transaction. Fines are marked as paid immediately.
              </p>

              {/* Cost breakdown */}
              <div className="p-4 rounded-xl bg-deep/50 border border-edge/20 space-y-2">
                <div className="flex justify-between text-xs text-muted">
                  <span>Type of Fee</span>
                  <span className="font-bold text-ink">
                    {fineItem ? 'Overdue Fine (Late Return)' : 'Bulk Payment'}
                  </span>
                </div>
                {fineItem && (
                  <div className="flex justify-between text-xs text-muted">
                    <span>Book Title</span>
                    <span className="font-bold text-ink truncate max-w-[200px] text-right">
                      {fineItem.loanId?.bookId?.title || 'Library Item'}
                    </span>
                  </div>
                )}
                {fineItem && (
                  <div className="flex justify-between text-xs text-muted">
                    <span>Calculation</span>
                    <span className="text-ink">₹5/day × {fineItem.overdueDays} days</span>
                  </div>
                )}
                <div className="border-t border-edge/25 my-2 pt-2 flex justify-between text-sm font-bold text-ink">
                  <span>Total Amount</span>
                  <span className="text-ember">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 p-3 border-2 border-ember bg-ember/5 text-ink text-xs font-bold rounded-xl focus:ring-2 focus:ring-ember">
                    <CreditCard size={16} className="text-ember" />
                    College Wallet
                  </button>
                  <button
                    disabled
                    className="flex items-center justify-center gap-2 p-3 border border-edge/40 text-muted text-xs font-bold rounded-xl cursor-not-allowed opacity-50"
                    title="Online payment via Stripe is coming soon"
                  >
                    Card (Stripe)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Button variant="ghost" className="flex-1 text-xs" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" className="flex-1 text-xs flex items-center justify-center gap-2" onClick={handlePay}>
                  <CreditCard size={14} />
                  Pay ₹{totalAmount.toFixed(2)}
                </Button>
              </div>
            </div>
          )}

          {step === 'paying' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Loader2 className="animate-spin text-ember" size={40} />
              <p className="text-sm font-semibold text-ink">Processing secure transaction...</p>
              <p className="text-xs text-muted">Do not refresh or close this tab.</p>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <CheckCircle className="text-success animate-bounce" size={48} />
                <h4 className="text-lg font-bold text-ink">Transaction Successful!</h4>
                <p className="text-xs text-muted">The outstanding fine has been cleared.</p>
              </div>

              {/* Receipt */}
              <div className="p-4 rounded-xl border border-dashed border-edge/40 bg-deep/30 text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted">Receipt Ref:</span>
                  <span className="font-bold text-ink">{paymentRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Date:</span>
                  <span className="text-ink">{new Date().toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Amount Paid:</span>
                  <span className="font-bold text-success">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Status:</span>
                  <span className="font-bold text-success uppercase">PAID</span>
                </div>
              </div>

              <Button variant="ghost" className="w-full text-xs font-bold" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
