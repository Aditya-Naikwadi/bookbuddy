import { useRef } from 'react';
import { Calendar, Ticket, CreditCard, CheckCircle, HelpCircle } from 'lucide-react';
import { Button } from '../../ui/Button';

export const FineBreakdownItem = ({ fine, userCoupons, onPayTrigger, onWaiverTrigger, isWaving }) => {
  const payBtnRef = useRef(null);
  const waiveBtnRef = useRef(null);

  const formattedDate = new Date(fine.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const title = fine.loanId?.bookId?.title || fine.reason || 'Library Checkout Fine';
  const isUnpaid = fine.status === 'unpaid';

  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl shadow-sm transition-all focus-within:ring-2 focus-within:ring-ember ${
        isUnpaid ? 'bg-danger/5 border-danger/25' : 'bg-surface/20 border-edge/30'
      }`}
    >
      {/* Details */}
      <div className="flex items-start gap-3">
        <div
          className={`p-3 rounded-lg shrink-0 ${
            isUnpaid ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
          }`}
        >
          {isUnpaid ? <HelpCircle size={20} /> : <CheckCircle size={20} />}
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-ink leading-tight text-sm truncate max-w-[280px] md:max-w-[400px]">
            {title}
          </h4>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              Incurred: {formattedDate}
            </span>
            <span>Calculation: ₹5/day × {fine.overdueDays} days late</span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span
              className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                fine.status === 'paid'
                  ? 'bg-success/10 text-success border border-success/25'
                  : fine.status === 'waived'
                  ? 'bg-indigo/10 text-indigo border border-indigo/25'
                  : 'bg-danger/10 text-danger border border-danger/25'
              }`}
            >
              {fine.status}
            </span>
            <span className="text-sm font-extrabold text-ink">₹{fine.amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isUnpaid && (
        <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0">
          {/* Waiver option */}
          <Button
            ref={waiveBtnRef}
            variant="ghost"
            onClick={() => onWaiverTrigger(fine, waiveBtnRef)}
            disabled={userCoupons <= 0 || isWaving}
            className="h-9 px-3 text-[11px] font-bold flex items-center gap-1 hover:bg-indigo/5 border-indigo/20 text-indigo disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Apply coupon to waive ₹${fine.amount.toFixed(2)} fine for ${title}`}
          >
            <Ticket size={14} />
            Use Coupon ({userCoupons})
          </Button>

          {/* Direct Pay option */}
          <Button
            ref={payBtnRef}
            variant="primary"
            onClick={() => onPayTrigger(fine, payBtnRef)}
            className="h-9 px-4 text-[11px] font-bold flex items-center gap-1 min-w-[90px]"
            aria-label={`Pay ₹${fine.amount.toFixed(2)} fine for ${title}`}
          >
            <CreditCard size={14} />
            Pay Now
          </Button>
        </div>
      )}
    </div>
  );
};
