import React from 'react';
import useAuthStore from '../../../store/authStore';
import { useLoansTracker } from '../../../hooks/useLoansTracker';
import { useStreakData } from '../../../hooks/useStreakData';
import { useCheckIn } from '../../../hooks/useCheckIn';
import { Flame, Snowflake, Clock, BookOpen, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';

const StudentDashboardHome = () => {
  const { user } = useAuthStore();
  const studentName = user?.name?.split(' ')[0] || 'Student';

  // Fetch active borrowing & fines data
  const { loans = [], totalFine = 0, isLoading: loadingLoans } = useLoansTracker();

  // Fetch streak check-in data
  const { streak, isLoading: loadingStreak } = useStreakData();
  const { checkIn, isCheckInPending } = useCheckIn();

  const activeLoans = loans.filter((l) => l.status === 'active');
  const { currentStreak = 0, freezesAvailable = 0, todayComplete = false } = streak || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-2">
      {/* Dynamic Greetings */}
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">Welcome back, {studentName}!</h1>
        <p className="text-sm text-slate-500 mt-1">Here is a quick look at your student pass, borrowing limits, and reading streak status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Currently Borrowed Books */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 md:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="text-indigo-600 w-5 h-5" />
                Currently Borrowed Books
              </h2>
              <Link to="/student-dashboard/loans" className="text-xs text-indigo font-bold hover:underline flex items-center gap-1">
                View All <ArrowRight size={12} />
              </Link>
            </div>

            {loadingLoans ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading active checkouts...</div>
            ) : activeLoans.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                You have no books checked out. Visit the catalog to find your next read!
              </div>
            ) : (
              <div className="space-y-3">
                {activeLoans.slice(0, 2).map((loan) => {
                  const isOverdue = new Date(loan.dueDate) < new Date() && loan.status === 'active';
                  const daysLeft = Math.ceil((new Date(loan.dueDate) - new Date()) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={loan._id}
                      className="flex items-center gap-4 p-3.5 border border-slate-100 rounded-2xl bg-slate-50/50"
                    >
                      <div className="w-12 h-16 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                        <BookOpen size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-slate-800 truncate">{loan.bookId?.title || 'Unknown Book'}</h3>
                        <p className={`text-xs mt-1 font-medium ${isOverdue ? 'text-danger' : 'text-slate-500'}`}>
                          {isOverdue ? 'Overdue!' : daysLeft === 0 ? 'Due Today!' : `Due in ${daysLeft} days`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Daily Streak Check-In Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
          {/* Flame decorative background */}
          <div className="absolute -right-8 -bottom-8 opacity-[0.03] text-orange-500 pointer-events-none">
            <Flame size={160} fill="currentColor" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Flame className="text-orange-500 w-5 h-5" fill="currentColor" />
                Reading Streak
              </h2>
              <span className="text-xl font-black text-orange-500 font-mono">{currentStreak} Days</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {todayComplete
                ? "Fantastic! You've checked in today. Your streak is protected."
                : "Check in now to extend your daily reading streak."}
            </p>

            <Button
              onClick={() => !todayComplete && checkIn()}
              disabled={todayComplete || isCheckInPending}
              className={`w-full h-11 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                todayComplete
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default hover:bg-emerald-500/10'
                  : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md'
              }`}
            >
              {isCheckInPending ? (
                <span>Validating...</span>
              ) : todayComplete ? (
                <>
                  <CheckCircle size={16} />
                  <span>Checked In Today ✓</span>
                </>
              ) : (
                <>
                  <Flame size={16} fill="currentColor" />
                  <span>Check In Today</span>
                </>
              )}
            </Button>

            {/* Ice Freezes */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2">
              <span>Freezes Available:</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Snowflake
                    key={i}
                    size={14}
                    className={i < freezesAvailable ? 'text-indigo animate-pulse' : 'text-slate-200'}
                    fill={i < freezesAvailable ? 'currentColor' : 'none'}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fines and Dues alerts widget */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <AlertCircle className="text-slate-400 w-5 h-5" />
              Outstanding Balance
            </h2>
          </div>

          <div
            className={`p-4 rounded-2xl border text-center ${
              totalFine > 0
                ? 'bg-red-500/5 border-red-500/20 text-red-700'
                : 'bg-slate-50 border-slate-100 text-slate-700'
            }`}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total Fines</p>
            <p className="text-3xl font-black mt-1 font-mono">₹{totalFine.toFixed(2)}</p>
          </div>

          <div className="mt-3 flex items-center gap-2 justify-center text-[10px] text-slate-500 font-bold">
            <Clock size={12} />
            <span>{totalFine > 0 ? 'Payment required immediately.' : 'No outstanding balances.'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardHome;
