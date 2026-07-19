import { useMemo } from 'react';
import { CheckCircle } from 'lucide-react';
import { LoanCard } from './LoanCard';

// Urgency levels calculation utility
const getUrgencyGroup = (dueDate) => {
  const due = new Date(dueDate);
  const now = new Date();
  
  if (due < now) {
    return { name: 'Overdue', color: 'text-danger bg-danger/10 border-danger/25', level: 3 };
  }
  
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 2) {
    return { name: 'Due Soon', color: 'text-amber-500 bg-amber-500/10 border-amber-500/25', level: 2 };
  }
  
  return { name: 'On Time', color: 'text-success bg-success/10 border-success/25', level: 1 };
};

export const LoansList = ({ activeLoans, onRenewTrigger, isRenewing, renewingLoanId }) => {
  // Sort loans by status level (Overdue -> Due Soon -> On Time) and then by soonest due date
  const sortedLoans = useMemo(() => {
    return [...activeLoans].sort((a, b) => {
      const urgencyA = getUrgencyGroup(a.dueDate);
      const urgencyB = getUrgencyGroup(b.dueDate);
      
      if (urgencyB.level !== urgencyA.level) {
        return urgencyB.level - urgencyA.level;
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [activeLoans]);

  if (sortedLoans.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center max-w-sm mx-auto glass-panel border border-edge/30 rounded-2xl p-8 bg-surface/20">
        <CheckCircle className="text-success/50 mb-3" size={40} />
        <h4 className="font-bold text-ink text-base">All clear!</h4>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          You don't have any physical books checked out from the library at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedLoans.map((loan) => {
        const urgency = getUrgencyGroup(loan.dueDate);
        return (
          <LoanCard
            key={loan._id}
            loan={loan}
            urgency={urgency}
            onRenewTrigger={onRenewTrigger}
            isRenewing={isRenewing}
            renewingLoanId={renewingLoanId}
          />
        );
      })}
    </div>
  );
};
