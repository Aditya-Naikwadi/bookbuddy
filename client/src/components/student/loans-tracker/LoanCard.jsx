import { useRef } from 'react';
import { BookOpen, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export const LoanCard = ({ loan, urgency, onRenewTrigger, isRenewing, renewingLoanId }) => {
  const renewBtnRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  const isOverdue = urgency.level === 3;
  const isDueSoon = urgency.level === 2;
  const eligibility = loan.renewalEligibility || { eligible: true, reason: null };

  const isCurrentRenewing = isRenewing && renewingLoanId === loan._id;

  // Formatting dates
  const issueDateStr = new Date(loan.issueDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const dueDateStr = new Date(loan.dueDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate days overdue or remaining
  const now = new Date();
  const due = new Date(loan.dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let statusText = '';
  if (isOverdue) {
    statusText = `${Math.abs(diffDays)} days overdue`;
  } else if (isDueSoon) {
    statusText = `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else {
    statusText = 'On time';
  }

  // Construct accessible descriptions for screen readers
  let disabledReason = '';
  if (!eligibility.eligible) {
    if (eligibility.reason === 'limit_reached') {
      disabledReason = `Renewal limit reached (${loan.renewalCount}/${loan.maxRenewals || 3})`;
    } else if (eligibility.reason === 'on_hold') {
      disabledReason = 'Another student has placed a hold reservation on this book.';
    } else {
      disabledReason = 'This item cannot be renewed at this time.';
    }
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 border rounded-xl shadow-sm transition-all focus-within:ring-2 focus-within:ring-ember ${
        isOverdue
          ? 'bg-danger/5 border-danger/25'
          : isDueSoon
          ? 'bg-amber-500/5 border-amber-500/25'
          : 'bg-surface/20 border-edge/30'
      }`}
    >
      {/* Book Cover and Info */}
      <div className="flex items-center gap-4 min-w-0">
        {loan.bookId?.coverImage ? (
          <img
            src={loan.bookId.coverImage}
            alt=""
            className="w-16 h-20 rounded shadow-sm object-cover shrink-0"
          />
        ) : (
          <div className="w-16 h-20 bg-surface/50 border border-edge rounded flex items-center justify-center text-muted/30 shrink-0">
            <BookOpen size={24} />
          </div>
        )}
        <div className="min-w-0">
          <h4 className="font-bold text-ink leading-tight text-base truncate pr-2">
            {loan.bookId?.title || 'Unknown Title'}
          </h4>
          <p className="text-xs text-muted mt-0.5 truncate">
            Author: {loan.bookId?.author || 'Unknown'}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-muted mt-1">
            <span>Issued: {issueDateStr}</span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                isOverdue
                  ? 'text-danger bg-danger/10 border-danger/25'
                  : isDueSoon
                  ? 'text-amber-500 bg-amber-500/10 border-amber-500/25'
                  : 'text-success bg-success/10 border-success/25'
              }`}
            >
              {isOverdue ? (
                <AlertTriangle
                  size={10}
                  className={prefersReducedMotion ? '' : 'animate-pulse'}
                />
              ) : (
                <Clock size={10} />
              )}
              {statusText}
            </span>
            <span className="text-xs font-semibold text-ink">Due: {dueDateStr}</span>
          </div>
        </div>
      </div>

      {/* Renewal Controls */}
      <div className="flex flex-col items-start sm:items-end justify-center gap-1 shrink-0">
        <Button
          ref={renewBtnRef}
          variant={eligibility.eligible ? 'primary' : 'ghost'}
          onClick={() => {
            if (eligibility.eligible && !isCurrentRenewing) {
              onRenewTrigger(loan, renewBtnRef);
            }
          }}
          disabled={!eligibility.eligible || isRenewing}
          aria-disabled={!eligibility.eligible}
          aria-describedby={!eligibility.eligible ? `reason-${loan._id}` : undefined}
          className={`text-xs px-4 h-9 font-bold flex items-center gap-1.5 min-w-[120px] ${
            !eligibility.eligible ? 'opacity-40 cursor-not-allowed border-edge hover:bg-transparent' : ''
          }`}
        >
          <RefreshCw size={14} className={isCurrentRenewing ? 'animate-spin' : ''} />
          {isCurrentRenewing ? 'Renewing...' : 'Renew'}
        </Button>

        {/* Explain why renewal is disabled */}
        {!eligibility.eligible && (
          <span
            id={`reason-${loan._id}`}
            className="text-[10px] font-medium text-danger flex items-center gap-1 mt-1 sm:text-right"
          >
            <AlertTriangle size={10} />
            {disabledReason}
          </span>
        )}

        {eligibility.eligible && (
          <span className="text-[10px] text-muted mt-1">
            Renewals: {loan.renewalCount} / {loan.maxRenewals || 3}
          </span>
        )}
      </div>
    </div>
  );
};
