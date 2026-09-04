import { useEffect, useRef, useState } from "react";
import {
  X,
  CheckCircle,
  CreditCard,
  Loader2,
  Receipt,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../../ui/Button";
import { useConfig } from "../../../context/ConfigContext.jsx";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../../../api/paymentApi";

// Helper script loader for Razorpay Checkout SDK (PCI compliant)
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const PaymentDialog = ({
  isOpen,
  onClose,
  triggerRef,
  fineItem,
  totalAmount,
  onConfirm,
}) => {
  const { razorpayKeyId } = useConfig();
  const dialogRef = useRef(null);
  const [step, setStep] = useState("confirm"); // 'confirm' | 'paying' | 'verifying_webhook' | 'success' | 'failed'
  const [paymentRef, setPaymentRef] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setStep("confirm");
      setErrorMessage("");
    }
  }

  const getFocusableElements = () => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
  };

  // Handle focus return and Escape key
  useEffect(() => {
    if (!isOpen) return;

    const triggerEl = triggerRef?.current;

    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      setTimeout(() => focusable[0].focus(), 50);
    }

    const handleKeyDown = (e) => {
      if (
        e.key === "Escape" &&
        step !== "paying" &&
        step !== "verifying_webhook"
      ) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (triggerEl) {
        triggerEl.focus();
      }
    };
  }, [isOpen, step, onClose, triggerRef]);

  // Launch Razorpay PCI-compliant checkout popup
  const handleRazorpayPayment = async () => {
    setStep("paying");
    setErrorMessage("");

    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      setErrorMessage(
        "Failed to load Razorpay payment SDK. Please check your internet connection.",
      );
      setStep("failed");
      return;
    }

    try {
      const amountInPaise = Math.max(100, Math.round(totalAmount * 100));

      // STEP 1: Call backend create-order endpoint to generate Razorpay Order ID
      const orderData = await createRazorpayOrder({
        amount: amountInPaise,
        currency: "INR",
        fineId: fineItem?._id,
      });

      const keyToUse =
        import.meta.env.VITE_RAZORPAY_KEY_ID ||
        orderData.key_id ||
        razorpayKeyId ||
        "rzp_test_TOm6pPV3QhF4Vr";

      // STEP 2: Configure Razorpay modal options with order_id
      const options = {
        key: keyToUse,
        amount: orderData.amount || amountInPaise,
        currency: orderData.currency || "INR",
        name: "BookBuddy Academic Library",
        description: fineItem
          ? `Fine payment for overdue item`
          : `Bulk library fine settlement`,
        order_id: orderData.order_id || orderData.id,
        image: "https://cdn-icons-png.flaticon.com/512/3145/3145765.png",
        handler: async function (response) {
          setStep("verifying_webhook");
          setPaymentRef(response.razorpay_payment_id || `PAY-${Date.now()}`);

          try {
            // STEP 3: Verify payment signature with backend verify-payment endpoint
            await verifyRazorpayPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              fineId: fineItem?._id,
            });

            if (typeof onConfirm === "function") {
              await onConfirm({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                fineId: fineItem?._id,
              });
            }

            setStep("success");
          } catch (verifyErr) {
            console.error("Payment verification failed:", verifyErr);
            setErrorMessage(
              verifyErr?.response?.data?.message ||
                "Payment received, but signature verification failed.",
            );
            setStep("failed");
          }
        },
        prefill: {
          name: "Student Patron",
          email: "student@bookbuddy.edu",
        },
        theme: {
          color: "#4f46e5",
        },
        modal: {
          ondismiss: function () {
            setStep("confirm");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        setErrorMessage(
          response.error?.description ||
            "Transaction was declined by payment gateway.",
        );
        setStep("failed");
      });
      rzp.open();
    } catch (err) {
      console.error("Razorpay order creation error:", err);
      setErrorMessage(
        err?.response?.data?.message ||
          err.message ||
          "Payment processing error.",
      );
      setStep("failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3
            id="dialog-title"
            className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
          >
            <Receipt className="text-indigo-600" size={20} />
            {step === "success" ? "Payment Receipt" : "Fine Payment Gateway"}
          </h3>
          {step !== "paying" && step !== "verifying_webhook" && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
                <span>
                  PCI-DSS Compliant Hosted Gateway — Card details never touch
                  our servers.
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Review your fine settlement summary below. Payments are
                processed via encrypted Razorpay checkout.
              </p>

              {/* Cost breakdown */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Type of Fee</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {fineItem
                      ? "Overdue Fine (Late Return)"
                      : "Bulk Fine Settlement"}
                  </span>
                </div>
                {fineItem && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Book Title</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px] text-right">
                      {fineItem.loanId?.bookId?.title || "Library Item"}
                    </span>
                  </div>
                )}
                {fineItem && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Overdue Days</span>
                    <span className="text-slate-900 dark:text-white font-mono">
                      {fineItem.overdueDays || 1} days
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-slate-700 my-2 pt-2 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                  <span>Total Due</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                    ₹{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <Button
                  variant="ghost"
                  className="flex-1 text-xs"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 text-xs flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  onClick={handleRazorpayPayment}
                >
                  <CreditCard size={14} />
                  Pay ₹{totalAmount.toFixed(2)} Now
                </Button>
              </div>
            </div>
          )}

          {step === "paying" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Opening Secure Razorpay Gateway...
              </p>
              <p className="text-xs text-slate-500">
                Please complete payment in the popup window.
              </p>
            </div>
          )}

          {step === "verifying_webhook" && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Verifying Webhook Confirmation...
              </p>
              <p className="text-xs text-slate-500">
                Reconciling transaction signature with backend servers...
              </p>
            </div>
          )}

          {step === "failed" && (
            <div className="space-y-4 text-center">
              <div className="p-3 bg-red-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-red-500">
                <AlertCircle size={28} />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Payment Unsuccessful
              </h4>
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-3 rounded-xl">
                {errorMessage || "Transaction was canceled or failed."}
              </p>
              <Button
                variant="ghost"
                className="w-full text-xs font-bold"
                onClick={() => setStep("confirm")}
              >
                Try Again
              </Button>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <CheckCircle
                  className="text-emerald-500 animate-bounce"
                  size={48}
                />
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Transaction Verified & Settled!
                </h4>
                <p className="text-xs text-slate-500">
                  Your library fine balance has been cleared.
                </p>
              </div>

              {/* Receipt */}
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Razorpay Ref:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {paymentRef}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {new Date().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{totalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    VERIFIED_PAID
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                className="w-full text-xs font-bold"
                onClick={onClose}
              >
                Close Receipt
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
