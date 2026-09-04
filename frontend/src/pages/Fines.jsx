import { useState, useEffect } from "react";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Receipt,
} from "lucide-react";
import { io as ioClient } from "socket.io-client";

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

export const Fines = () => {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [processingState, setProcessingState] = useState(null); // null | 'processing' | 'confirmed' | 'failed'

  const fetchFines = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
        setErrorMsg(null);
      }
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/fines", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFines(data.data || []);
      } else {
        setFines([]);
      }
    } catch (err) {
      console.error("Error fetching fines:", err);
      setFines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Asynchronous fines list fetch updates state after API response
    fetchFines();

    // Socket.io push listener for webhook confirmation (F7.5)
    let socket;
    try {
      socket = ioClient(window.location.origin, {
        auth: { token: localStorage.getItem("token") },
      });

      socket.on("payment:confirmed", (payload) => {
        if (payload.orderId === activeOrderId || activeOrderId) {
          setProcessingState("confirmed");
          fetchFines();
        }
      });
    } catch {
      // Socket fallback to polling
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [activeOrderId]);

  // Polling fallback mechanism checking GET /api/v1/payments/:orderId/status
  useEffect(() => {
    if (!activeOrderId || processingState !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/v1/payments/${activeOrderId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.ok && data.success && data.data.status === "paid") {
          setProcessingState("confirmed");
          clearInterval(interval);
          await fetchFines();
        }
      } catch (err) {
        console.error("Status poll error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeOrderId, processingState]);

  const handlePayFines = async () => {
    try {
      setErrorMsg(null);
      setProcessingState("processing");

      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setErrorMsg(
          "Failed to load Razorpay SDK. Please check your network connection.",
        );
        setProcessingState("failed");
        return;
      }

      const token = localStorage.getItem("token");
      const unpaidIds = fines
        .filter((f) => f.status === "unpaid")
        .map((f) => f._id);

      // STEP 1: Call server-computed order creation endpoint (F7.3)
      const res = await fetch("/api/v1/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fineIds: unpaidIds,
          amount: 1.0, // Client attempts to send manipulated amount — server IGNORES it!
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.message || "Order creation failed.");
        setProcessingState("failed");
        return;
      }

      const orderData = data.data;
      setActiveOrderId(orderData.orderId);

      // STEP 2: Launch Razorpay hosted checkout SDK
      const options = {
        key: orderData.keyId || "rzp_test_dummy_key_id",
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "BookBuddy Library Fines",
        description: "Fine Settlement",
        order_id: orderData.orderId,
        handler: async function () {
          // Client callback: transition UI to "Payment processing...", NEVER "Paid" until webhook verifies
          setProcessingState("processing");
        },
        modal: {
          ondismiss: function () {
            // ACCEPTANCE CRITERIA F7.5: Closing checkout window immediately after payment
            // leaves UI in 'processing' state until webhook confirms payment — UI is not the source of truth!
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment launch error:", err);
      setErrorMsg("Error launching payment gateway.");
      setProcessingState("failed");
    }
  };

  const unpaidFines = fines.filter((f) => f.status === "unpaid");
  const totalUnpaidAmount = unpaidFines.reduce(
    (sum, f) => sum + (f.amount || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Receipt className="w-3.5 h-3.5" /> Patron Financial Settlement
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Outstanding Library Fines
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Settle overdue fines securely using Razorpay PCI-DSS compliant
            payment gateway.
          </p>
        </div>

        <button
          onClick={fetchFines}
          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors border border-slate-800 flex items-center gap-2 text-xs font-medium self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Balance</span>
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-sm flex items-center gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Processing Banner (F7.5) */}
      {processingState === "processing" && (
        <div className="p-5 rounded-3xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 mb-8 flex items-center gap-4 animate-pulse shadow-xl">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin flex-shrink-0" />
          <div>
            <div className="font-bold text-base text-white">
              Payment Processing...
            </div>
            <div className="text-xs text-indigo-300 mt-0.5">
              Reconciling webhook confirmation with server. State will update
              automatically once verified.
            </div>
          </div>
        </div>
      )}

      {/* Confirmed Banner */}
      {processingState === "confirmed" && (
        <div className="p-5 rounded-3xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 mb-8 flex items-center gap-4 shadow-xl">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-base text-white">
              Payment Confirmed & Verified!
            </div>
            <div className="text-xs text-emerald-300 mt-0.5">
              Webhook signature verified by server. Outstanding balance cleared.
            </div>
          </div>
        </div>
      )}

      {/* Main Balance & Action Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Total Outstanding Balance
            </div>
            <div className="text-4xl font-extrabold text-white font-mono">
              ₹{totalUnpaidAmount.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>PCI-DSS Secured Gateway</span>
            </div>
          </div>

          <button
            disabled={
              totalUnpaidAmount <= 0 || processingState === "processing"
            }
            onClick={handlePayFines}
            className="mt-6 w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>
              {processingState === "processing"
                ? "Processing..."
                : `Pay ₹${totalUnpaidAmount.toFixed(2)} Now`}
            </span>
          </button>
        </div>

        {/* Fine Items Breakdown */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" /> Fine Itemization (
            {fines.length})
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-slate-800/40 rounded-2xl animate-pulse"
                ></div>
              ))}
            </div>
          ) : fines.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No fine records associated with your account.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {fines.map((item) => {
                const isPaid = item.status === "paid";
                const bookTitle =
                  (item.loanId || {}).bookId?.title || "Library Resource";

                return (
                  <div
                    key={item._id}
                    className="py-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">
                        {bookTitle}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Overdue by {item.overdueDays || 1} days
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right font-mono font-bold text-sm text-white">
                        ₹{(item.amount || 0).toFixed(2)}
                      </div>

                      {isPaid ? (
                        <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Unpaid
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Fines;
