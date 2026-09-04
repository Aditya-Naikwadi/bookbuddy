import { useState, useMemo, useRef } from "react";
import { useLoansTracker } from "../../../hooks/useLoansTracker";
import { LoansList } from "./LoansList";
import { FinesSummary } from "./FinesSummary";
import { FineBreakdownItem } from "./FineBreakdownItem";
import { QueueHoldsList } from "./QueueHoldsList";
import { HistoryList } from "./HistoryList";
import { PaymentDialog } from "./PaymentDialog";
import {
  Loader2,
  Search,
  Filter,
  BookOpen,
  AlertTriangle,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import { Button } from "../../ui/Button";

export const LoansTracker = ({ defaultTab = "loans" }) => {
  const {
    loans,
    queue,
    fines,
    finesSummary,
    profile,
    isLoading,
    isError,
    renewLoan,
    payFine,
    cancelHold,
    isRenewing,
    renewingLoanId,
    isPaying,
    isCancellingHold,
    cancellingHoldId,
  } = useLoansTracker();

  // Tab State
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Live Region announcement
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Payment Dialog State
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedFine, setSelectedFine] = useState(null);
  const [useWaiverForSelected, setUseWaiverForSelected] = useState(false);
  const triggerButtonRef = useRef(null);

  // 1. Filtered Loans
  const filteredActiveLoans = useMemo(() => {
    return loans.active.filter((loan) => {
      const title = loan.bookId?.title || "";
      const author = loan.bookId?.author || "";
      const matchesSearch =
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        author.toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === "all") return matchesSearch;

      const due = new Date(loan.dueDate);
      const now = new Date();
      const isOverdue = due < now;
      const diffTime = due.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isDueSoon = !isOverdue && diffDays <= 2;

      if (statusFilter === "overdue") return matchesSearch && isOverdue;
      if (statusFilter === "due_soon") return matchesSearch && isDueSoon;
      if (statusFilter === "on_time")
        return matchesSearch && !isOverdue && !isDueSoon;

      return matchesSearch;
    });
  }, [loans.active, searchQuery, statusFilter]);

  // Unpaid fines list
  const unpaidFinesList = useMemo(() => {
    return fines.filter((f) => f.status === "unpaid");
  }, [fines]);

  // Total balance and counts
  const totalUnpaidAmount = finesSummary.totalUnpaid || 0;
  const unpaidCount = finesSummary.unpaidCount || 0;
  const userCoupons = profile?.fineWaiverCoupons || 0;

  // 2. Event Handlers
  const handleRenew = async (loan) => {
    setLiveAnnouncement(`Attempting to renew "${loan.bookId?.title}"...`);
    try {
      const res = await renewLoan(loan._id);
      const newDueDate = res?.data?.dueDate
        ? new Date(res.data.dueDate).toLocaleDateString()
        : "extended date";
      setLiveAnnouncement(
        `"${loan.bookId?.title}" renewed successfully. New due date is ${newDueDate}.`,
      );
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to renew book";
      setLiveAnnouncement(`Renewal failed: ${errorMsg}.`);
    }
  };

  const handleCancelHold = async (holdId) => {
    setLiveAnnouncement("Cancelling reservation hold...");
    try {
      await cancelHold(holdId);
      setLiveAnnouncement("Reservation hold cancelled successfully.");
    } catch {
      setLiveAnnouncement("Failed to cancel reservation hold.");
    }
  };

  const openPaySingle = (fine, btnRef) => {
    triggerButtonRef.current = btnRef.current;
    setSelectedFine(fine);
    setUseWaiverForSelected(false);
    setIsPayOpen(true);
  };

  const openWaiverSingle = (fine, btnRef) => {
    triggerButtonRef.current = btnRef.current;
    setSelectedFine(fine);
    setUseWaiverForSelected(true);
    setIsPayOpen(true);
  };

  const openPayAll = (btnRef) => {
    triggerButtonRef.current = btnRef.current;
    setSelectedFine(null);
    setUseWaiverForSelected(false);
    setIsPayOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (selectedFine) {
      setLiveAnnouncement(
        useWaiverForSelected
          ? "Applying waiver coupon..."
          : "Processing wallet payment...",
      );
      await payFine({
        fineId: selectedFine._id,
        useWaiver: useWaiverForSelected,
      });
      setLiveAnnouncement(
        useWaiverForSelected
          ? "Fine waived successfully."
          : `Fine of ₹${selectedFine.amount.toFixed(2)} paid successfully.`,
      );
    } else {
      setLiveAnnouncement(`Paying all ${unpaidCount} outstanding fines...`);
      // Sequential payment process
      for (const fine of unpaidFinesList) {
        await payFine({ fineId: fine._id, useWaiver: false });
      }
      setLiveAnnouncement(
        `All fines totaling ₹${totalUnpaidAmount.toFixed(2)} paid successfully.`,
      );
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 space-y-4"
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="animate-spin text-ember" size={36} />
        <p className="text-sm text-muted">
          Retrieving your borrowing details...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
        <AlertTriangle className="text-danger mb-3 animate-bounce" size={40} />
        <h3 className="text-lg font-bold text-ink">Unable to load loans</h3>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          There was an error communicating with the BookBuddy servers. Please
          check your connection and reload.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6">
      {/* Screen Reader Announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {liveAnnouncement}
      </div>

      {/* User Dashboard Profile summary Banner */}
      <div className="relative overflow-hidden glass-panel border border-edge/30 rounded-2xl p-6 bg-gradient-to-br from-surface/40 via-surface/35 to-deep/45 shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none hidden sm:block">
          <BookOpen size={160} />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ember flex items-center gap-1">
              <Sparkles size={12} />
              BookBuddy Student Member
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-black text-ink mt-1">
              Welcome back, {profile?.name || "Student"}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted font-medium">
              <span>
                Card ID:{" "}
                <strong className="text-ink">
                  {profile?.studentId || "N/A"}
                </strong>
              </span>
              <span>•</span>
              <span>
                Major:{" "}
                <strong className="text-ink">{profile?.major || "N/A"}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 shrink-0 sm:min-w-[280px]">
            <div className="p-3 border border-edge/20 rounded-xl bg-deep/30">
              <span className="block text-[10px] text-muted font-bold uppercase tracking-wider">
                Active Borrowed
              </span>
              <span className="text-xl font-serif font-black text-ink">
                {loans.active.length} item(s)
              </span>
            </div>
            <div className="p-3 border border-edge/20 rounded-xl bg-deep/30">
              <span className="block text-[10px] text-muted font-bold uppercase tracking-wider">
                Outstanding Dues
              </span>
              <span
                className={`text-xl font-serif font-black ${totalUnpaidAmount > 0 ? "text-danger" : "text-success"}`}
              >
                ₹{totalUnpaidAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Outstanding fine Callout Alert banner */}
      {totalUnpaidAmount > 0 && activeTab !== "fines" && (
        <div className="flex items-center justify-between p-4 border border-danger/20 bg-danger/5 rounded-xl animate-pulse-slow">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-danger shrink-0" size={18} />
            <p className="text-xs font-semibold text-ink">
              You have{" "}
              <strong className="text-danger">
                ₹{totalUnpaidAmount.toFixed(2)}
              </strong>{" "}
              in outstanding library fines.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("fines")}
            className="text-[10px] px-3 h-8 font-bold border-danger/25 text-danger hover:bg-danger/10"
          >
            Pay Balance
          </Button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-edge/20">
        <button
          onClick={() => setActiveTab("loans")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors focus:outline-none ${
            activeTab === "loans"
              ? "border-ember text-ember"
              : "border-transparent text-muted hover:text-ink"
          }`}
          aria-selected={activeTab === "loans"}
          role="tab"
        >
          Active Borrowing ({loans.active.length})
        </button>
        <button
          onClick={() => setActiveTab("fines")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors focus:outline-none ${
            activeTab === "fines"
              ? "border-ember text-ember"
              : "border-transparent text-muted hover:text-ink"
          }`}
          aria-selected={activeTab === "fines"}
          role="tab"
        >
          Fines & Balances (₹{totalUnpaidAmount.toFixed(2)})
        </button>
      </div>

      {/* Tab Content Panels */}
      <div className="space-y-6">
        {activeTab === "loans" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Active Borrowed Books Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-edge/10">
                <h3 className="text-base font-bold text-ink">
                  Currently Borrowed
                </h3>

                {/* Filter and Search controls */}
                {loans.active.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="Search books..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 w-40 sm:w-48 bg-deep/50 border border-edge/30 rounded-lg text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ember focus:border-ember"
                      />
                    </div>
                    {/* Filter selector */}
                    <div className="flex items-center gap-1 bg-deep/50 border border-edge/30 rounded-lg px-2 py-1">
                      <Filter className="text-muted w-3 h-3" />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-bold text-ink focus:outline-none focus:ring-0 cursor-pointer"
                      >
                        <option value="all" className="bg-surface">
                          All Status
                        </option>
                        <option
                          value="overdue"
                          className="bg-surface text-danger"
                        >
                          Overdue
                        </option>
                        <option
                          value="due_soon"
                          className="bg-surface text-amber-500"
                        >
                          Due Soon
                        </option>
                        <option
                          value="on_time"
                          className="bg-surface text-success"
                        >
                          On Time
                        </option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <LoansList
                activeLoans={filteredActiveLoans}
                onRenewTrigger={handleRenew}
                isRenewing={isRenewing}
                renewingLoanId={renewingLoanId}
              />
            </div>

            {/* Hold Queue & History Columns */}
            <div className="space-y-6">
              {/* Queue Holds */}
              <div className="glass-panel border border-edge/30 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-edge/20 bg-surface/10">
                  <h3 className="font-bold text-sm text-ink">
                    My Reservation Queue Holds
                  </h3>
                </div>
                <div className="p-4">
                  <QueueHoldsList
                    queue={queue}
                    onCancelHoldTrigger={handleCancelHold}
                    isCancelling={isCancellingHold}
                    cancellingHoldId={cancellingHoldId}
                  />
                </div>
              </div>

              {/* History */}
              <div className="glass-panel border border-edge/30 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-edge/20 bg-surface/10">
                  <h3 className="font-bold text-sm text-ink">
                    Borrowing History
                  </h3>
                </div>
                <div className="p-4">
                  <HistoryList history={loans.history} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Fines and dues Panel */
          <div className="space-y-6">
            <FinesSummary
              totalUnpaid={totalUnpaidAmount}
              unpaidCount={unpaidCount}
              userCoupons={userCoupons}
              onPayAllTrigger={openPayAll}
            />

            <div className="glass-panel border border-edge/30 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-edge/20 bg-surface/10">
                <h3 className="font-bold text-base text-ink">Itemized Fines</h3>
              </div>
              <div className="p-5 space-y-4">
                {unpaidFinesList.length === 0 ? (
                  <div className="text-center py-10 flex flex-col items-center">
                    <CheckCircle className="text-success/50 mb-2" size={32} />
                    <p className="text-sm font-bold text-ink">All Paid Up!</p>
                    <p className="text-xs text-muted mt-1">
                      You have no pending unpaid library fines.
                    </p>
                  </div>
                ) : (
                  unpaidFinesList.map((fine) => (
                    <FineBreakdownItem
                      key={fine._id}
                      fine={fine}
                      userCoupons={userCoupons}
                      onPayTrigger={openPaySingle}
                      onWaiverTrigger={openWaiverSingle}
                      isWaving={isPaying}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accessible Payment Modal Dialog */}
      <PaymentDialog
        isOpen={isPayOpen}
        onClose={() => setIsPayOpen(false)}
        triggerRef={triggerButtonRef}
        fineItem={selectedFine}
        allFines={unpaidFinesList}
        totalAmount={
          useWaiverForSelected
            ? 0
            : selectedFine
              ? selectedFine.amount
              : totalUnpaidAmount
        }
        onConfirm={handleConfirmPayment}
        isProcessing={isPaying}
      />
    </div>
  );
};
