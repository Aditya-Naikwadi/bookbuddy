import { useState } from "react";
import { useStudentOverview } from "../../../hooks/useStudentOverview";
import useAuthStore from "../../../store/authStore";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { ReadingAnalyticsChart } from "../../../components/student/analytics/ReadingAnalyticsChart";
import { NotificationDrawer } from "../../../components/student/notifications/NotificationDrawer";
import { BadgeUnlockModal } from "../../../components/student/streak/BadgeUnlockModal";

import {
  Flame,
  Snowflake,
  Clock,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  Bookmark,
  Award,
  QrCode,
  Laptop,
  ChevronRight,
  RefreshCw,
  XCircle,
  ShieldAlert,
  GraduationCap,
  BookMarked,
  Layers,
  CreditCard,
  Bell,
} from "lucide-react";

export const StudentDashboardHome = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const {
    overview,
    isLoading,
    isError,
    refetch,
    renewLoan,
    isRenewing,
    renewingLoanId,
    checkIn,
    isCheckInPending,
    cancelHold,
    isCancellingHold,
    cancellingHoldId,
  } = useStudentOverview();

  const [renewalMessage, setRenewalMessage] = useState(null);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unlockedBadgesToCelebrated, setUnlockedBadgesToCelebrated] = useState(
    [],
  );

  // Extract data from unified overview endpoint with robust fallbacks
  const studentUser = overview?.user || authUser || {};
  const studentName =
    typeof studentUser?.name === "string" ? studentUser.name : "Student";
  const firstName = studentName.split(" ")[0] || "Student";
  const activeLoans = Array.isArray(overview?.activeLoans)
    ? overview.activeLoans
    : [];
  const finesSummary = overview?.finesSummary || {
    totalUnpaid: 0,
    unpaidCount: 0,
  };
  const reservations = Array.isArray(overview?.reservations)
    ? overview.reservations
    : [];
  const streak = overview?.streak || {
    currentStreak: 0,
    freezesAvailable: 0,
    todayComplete: false,
  };
  const recentProgress = overview?.recentReadingProgress;
  const eresource =
    typeof recentProgress?.eresourceId === "object" &&
    recentProgress?.eresourceId !== null
      ? recentProgress.eresourceId
      : null;
  const recommendations = Array.isArray(overview?.recommendations)
    ? overview.recommendations
    : [];
  const unreadNotificationsCount = overview?.unreadNotificationsCount || 0;

  const totalFine = Number(finesSummary?.totalUnpaid || 0);
  const {
    currentStreak = 0,
    freezesAvailable = 0,
    todayComplete = false,
  } = streak;

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Check in handler with confetti celebration & Badge unlock modal trigger
  const handleCheckIn = async () => {
    if (todayComplete || isCheckInPending) return;
    try {
      const res = await checkIn();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Check if response contains newlyUnlocked badges
      const newlyUnlocked = res?.data?.newlyUnlocked || res?.newlyUnlocked;
      if (Array.isArray(newlyUnlocked) && newlyUnlocked.length > 0) {
        setUnlockedBadgesToCelebrated(newlyUnlocked);
      }
    } catch {
      // Error handled by mutation
    }
  };

  // Loan Renewal handler
  const handleRenew = async (loanId) => {
    try {
      setRenewalMessage(null);
      const res = await renewLoan(loanId);
      setRenewalMessage({
        type: "success",
        text: res?.message || "Loan successfully renewed for 14 days!",
      });
      setTimeout(() => setRenewalMessage(null), 5000);
    } catch (err) {
      setRenewalMessage({
        type: "error",
        text: err?.response?.data?.message || "Failed to renew loan.",
      });
      setTimeout(() => setRenewalMessage(null), 5000);
    }
  };

  // Cancel hold handler
  const handleCancelHold = async (reservationId) => {
    try {
      await cancelHold(reservationId);
    } catch (err) {
      console.error("Failed to cancel hold:", err);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center bg-red-500/10 border border-red-500/20 rounded-3xl my-12">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Unable to Load Student Dashboard
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
          Please check your backend connection or try refreshing the dashboard.
        </p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* Slide-over Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />

      {/* Celebration Badge Unlock Modal */}
      {unlockedBadgesToCelebrated.length > 0 && (
        <BadgeUnlockModal
          unlockedBadges={unlockedBadgesToCelebrated}
          onClose={() => setUnlockedBadgesToCelebrated([])}
        />
      )}

      {/* Renewal / Action Alert Banner */}
      <AnimatePresence>
        {renewalMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold ${
              renewalMessage.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                : "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {renewalMessage.type === "success" ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{renewalMessage.text}</span>
            </div>
            <button
              onClick={() => setRenewalMessage(null)}
              className="opacity-60 hover:opacity-100"
            >
              <XCircle size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Welcome & Student Digital Pass Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-indigo-500/20">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs text-indigo-200 font-medium">
                <GraduationCap size={14} className="text-indigo-400" />
                <span>Student Academic Library Portal</span>
              </div>

              {/* Notification Bell Icon in Header */}
              <button
                onClick={() => setIsNotificationOpen(true)}
                className="relative p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all border border-white/10"
                title="Open Notifications"
              >
                <Bell size={16} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight leading-tight">
              {getGreeting()}, {firstName}! 👋
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your personalized reading hub is up to date. You have{" "}
              <strong className="text-indigo-300 font-semibold">
                {activeLoans.length} active checkouts
              </strong>{" "}
              and{" "}
              <strong className="text-orange-300 font-semibold">
                {currentStreak} day streak
              </strong>{" "}
              active today.
            </p>

            {/* Quick Action Badges */}
            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <Link
                to="/catalog"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Search size={14} />
                <span>Browse Catalog</span>
              </Link>
              <Link
                to="/patron-card"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <QrCode size={14} className="text-indigo-300" />
                <span>Digital ID Pass</span>
              </Link>
              <Link
                to="/lab-booking"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <Laptop size={14} className="text-purple-300" />
                <span>Book Lab Seat</span>
              </Link>
            </div>
          </div>

          {/* Student Pass Badge Widget */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-4 sm:p-5 flex items-center gap-4 min-w-[280px]">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white/20">
              {firstName && firstName[0] ? firstName[0].toUpperCase() : "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
                Pass ID #{studentUser?.studentId || "STU-1001"}
              </p>
              <p className="text-sm font-bold text-white truncate">
                {studentName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-slate-300 font-medium">
                  Active Patron
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Active Loans */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Loans
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {activeLoans.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Max limit: 5 books
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <BookOpen size={22} />
          </div>
        </div>

        {/* Metric 2: Reading Streak */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Reading Streak
            </p>
            <p className="text-2xl font-black text-orange-500 mt-1 font-mono">
              {currentStreak} Days
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {todayComplete ? "Checked in today ✓" : "Check-in pending"}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-500 flex items-center justify-center">
            <Flame size={22} fill="currentColor" />
          </div>
        </div>

        {/* Metric 3: Active Holds */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Holds
            </p>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 font-mono">
              {reservations.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">In pickup queue</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <BookMarked size={22} />
          </div>
        </div>

        {/* Metric 4: Fines & Dues */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Unpaid Fines
            </p>
            <p
              className={`text-2xl font-black mt-1 font-mono ${totalFine > 0 ? "text-red-600" : "text-emerald-600"}`}
            >
              ₹{(isNaN(totalFine) ? 0 : totalFine).toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {totalFine > 0 ? "Payment required" : "Clear balance"}
            </p>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${totalFine > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}
          >
            <CreditCard size={22} />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Currently Borrowed Books, Analytics Chart, Holds */}
        <div className="lg:col-span-2 space-y-6">
          {/* Item 1: Reading Analytics Chart Widget */}
          <ReadingAnalyticsChart />

          {/* Section: Currently Borrowed Books */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Currently Borrowed Books
                  </h2>
                  <p className="text-xs text-slate-500">
                    Track return due dates and renew eligible checkouts
                  </p>
                </div>
              </div>
              <Link
                to="/loans"
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                View All Loans <ArrowRight size={12} />
              </Link>
            </div>

            {activeLoans.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-3">
                <BookOpen
                  size={36}
                  className="mx-auto text-slate-300 dark:text-slate-700"
                />
                <p className="font-medium">
                  You have no books currently checked out.
                </p>
                <Link
                  to="/catalog"
                  className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow"
                >
                  Explore Library Catalog
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {activeLoans.map((loan) => {
                  const book = loan.bookId || {};
                  const dueDate = new Date(loan.dueDate);
                  const now = new Date();
                  const isOverdue = dueDate < now && loan.status === "active";
                  const daysLeft = Math.ceil(
                    (dueDate - now) / (1000 * 60 * 60 * 24),
                  );
                  const maxDays = loan.maxLoanDays || 14;
                  const daysElapsed = Math.max(0, maxDays - daysLeft);
                  const progressPct = Math.min(
                    100,
                    Math.max(5, (daysElapsed / maxDays) * 100),
                  );

                  const eligibility = loan.renewalEligibility || {
                    eligible: true,
                  };

                  return (
                    <motion.div
                      key={loan._id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {book.coverImage ? (
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="w-12 h-16 object-cover rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-16 bg-indigo-100 dark:bg-indigo-950/60 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0 font-bold text-xs">
                              <BookOpen size={20} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {book.title || "Library Title"}
                            </h3>
                            <p className="text-xs text-slate-500 truncate">
                              {book.author || "Unknown Author"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                                  isOverdue
                                    ? "bg-red-500/10 text-red-600 border border-red-500/20"
                                    : daysLeft <= 2
                                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                }`}
                              >
                                <Clock size={10} />
                                {isOverdue
                                  ? "Overdue!"
                                  : daysLeft === 0
                                    ? "Due Today!"
                                    : `${daysLeft} days left`}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Renewals: {loan.renewalCount || 0}/
                                {loan.maxRenewals || 2}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Renewal Action */}
                        <div className="flex items-center sm:flex-col items-end gap-2">
                          <button
                            onClick={() => handleRenew(loan._id)}
                            disabled={!eligibility.eligible || isRenewing}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                              eligibility.eligible
                                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                            }`}
                          >
                            <RefreshCw
                              size={13}
                              className={
                                isRenewing && renewingLoanId === loan._id
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                            <span>
                              {isRenewing && renewingLoanId === loan._id
                                ? "Renewing..."
                                : "Renew Loan"}
                            </span>
                          </button>
                          {!eligibility.eligible && (
                            <p className="text-[10px] text-red-500 font-medium text-right max-w-[140px] truncate">
                              {eligibility.reason === "on_hold"
                                ? "Blocked: Reserved by student"
                                : eligibility.reason === "limit_reached"
                                  ? "Max renewals reached"
                                  : eligibility.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Loan Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOverdue
                                ? "bg-red-500"
                                : daysLeft <= 2
                                  ? "bg-amber-500"
                                  : "bg-indigo-600"
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Active Holds Radar */}
          {reservations.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600 dark:text-purple-400">
                    <BookMarked size={18} />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Active Reservation Holds
                  </h2>
                </div>
                <span className="text-xs text-purple-600 font-bold bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-full">
                  {reservations.length} Queue Items
                </span>
              </div>

              <div className="space-y-3">
                {reservations.map((res) => {
                  const book = res.bookId || {};
                  const isReady = res.status === "ready_for_pickup";

                  return (
                    <div
                      key={res._id}
                      className="flex items-center justify-between p-3.5 border border-purple-100 dark:border-slate-800 rounded-2xl bg-purple-50/30 dark:bg-purple-950/20"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          <Bookmark size={18} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {book.title || "Reserved Book"}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {book.author || "Author"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isReady
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 animate-pulse"
                              : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                          }`}
                        >
                          {isReady
                            ? "Ready at Desk!"
                            : `Queue #${res.queuePosition || 1}`}
                        </span>
                        <button
                          onClick={() => handleCancelHold(res._id)}
                          disabled={
                            isCancellingHold && cancellingHoldId === res._id
                          }
                          className="text-xs text-slate-400 hover:text-red-500 p-1 font-bold transition-colors"
                          title="Cancel Hold"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Resume Reading E-Resource Card */}
          {eresource && (
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-lg border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-16 rounded-lg bg-indigo-600/40 flex items-center justify-center font-bold text-indigo-300 flex-shrink-0">
                  <Sparkles size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">
                    Resume Digital Reading
                  </p>
                  <h4 className="font-bold text-sm text-white truncate">
                    {eresource.title || "Digital Resource"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Page {recentProgress?.currentPage || 1} • Last read recently
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  navigate(`/eresources/read/${eresource._id || eresource.id}`)
                }
                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 flex-shrink-0"
              >
                <span>Continue Reading</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Reading Streak & Quick Action Hub */}
        <div className="space-y-6">
          {/* Daily Streak Check-in Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
            {/* Background Flame Glow */}
            <div className="absolute -right-10 -bottom-10 opacity-5 text-orange-500 pointer-events-none">
              <Flame size={180} fill="currentColor" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Flame
                    className="text-orange-500 w-5 h-5"
                    fill="currentColor"
                  />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Reading Streak
                  </h2>
                </div>
                <span className="text-xl font-black text-orange-500 font-mono">
                  {currentStreak} Days
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                {todayComplete
                  ? "Awesome job! You've logged your check-in today. Your daily streak is safe."
                  : "Check in today to keep your reading streak alive and earn achievements!"}
              </p>

              <button
                onClick={handleCheckIn}
                disabled={todayComplete || isCheckInPending}
                className={`w-full h-11 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                  todayComplete
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 cursor-default"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                }`}
              >
                {isCheckInPending ? (
                  <span>Checking in...</span>
                ) : todayComplete ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Checked In Today ✓</span>
                  </>
                ) : (
                  <>
                    <Flame size={16} fill="currentColor" />
                    <span>Check In Today</span>
                  </>
                )}
              </button>

              {/* Ice Freezes Indicator */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2">
                <span>Freezes Available:</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Snowflake
                      key={i}
                      size={14}
                      className={
                        i < freezesAvailable
                          ? "text-indigo-500 animate-pulse"
                          : "text-slate-200 dark:text-slate-700"
                      }
                      fill={i < freezesAvailable ? "currentColor" : "none"}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Grid */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={18} className="text-indigo-600" />
              Quick Services
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Link
                to="/reading-lists"
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 transition-all border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-2 font-bold"
              >
                <Bookmark size={20} className="text-indigo-600" />
                <span>Reading Lists</span>
              </Link>
              <Link
                to="/e-resources"
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 hover:text-purple-600 transition-all border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-2 font-bold"
              >
                <Sparkles size={20} className="text-purple-600" />
                <span>E-Resources</span>
              </Link>
              <Link
                to="/fines"
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 transition-all border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-2 font-bold"
              >
                <CreditCard size={20} className="text-emerald-600" />
                <span>Pay Fines</span>
              </Link>
              <Link
                to="/achievements"
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 transition-all border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-2 font-bold"
              >
                <Award size={20} className="text-amber-500" />
                <span>Badges</span>
              </Link>
            </div>
          </div>

          {/* Recommended Books Section */}
          {recommendations.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recommended for You
                </h2>
                <Link
                  to="/recommendations"
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  More
                </Link>
              </div>

              <div className="space-y-3">
                {recommendations.slice(0, 3).map((book) => (
                  <div
                    key={book._id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    {book.coverImage ? (
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-10 h-14 object-cover rounded-md flex-shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center text-slate-400 font-bold text-xs flex-shrink-0">
                        <BookOpen size={16} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {book.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        {book.author}
                      </p>
                      <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                        {book.category || "General"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Animated Skeleton Loading State for Zero Layout Shift
const DashboardSkeleton = () => (
  <div className="space-y-8 max-w-7xl mx-auto px-2 sm:px-4 py-4 animate-pulse">
    {/* Hero Banner Skeleton */}
    <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full" />

    {/* Metric Cards Skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"
        />
      ))}
    </div>

    {/* Content Grid Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
      <div className="space-y-6">
        <div className="h-56 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    </div>
  </div>
);

export default StudentDashboardHome;
