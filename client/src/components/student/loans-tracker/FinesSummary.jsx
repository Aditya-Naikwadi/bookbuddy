import { useRef } from 'react';
import { Receipt, AlertTriangle, Calendar, Ticket } from 'lucide-react';
import { Button } from '../../ui/Button';

export const FinesSummary = ({ totalUnpaid, unpaidCount, userCoupons, onPayAllTrigger }) => {
  const payAllBtnRef = useRef(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Balance Card */}
      <div className="md:col-span-2 glass-panel border border-edge/30 rounded-2xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden bg-gradient-to-br from-surface/40 via-surface/30 to-deep/40">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Receipt size={16} className="text-ember" />
              Outstanding Balance
            </h3>
            <p className="text-xs text-muted mt-1">Total outstanding fines due on checkouts.</p>
          </div>
          {totalUnpaid > 0 && (
            <span className="bg-danger/10 text-danger text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-danger/25 uppercase">
              {unpaidCount} item{unpaidCount > 1 ? 's' : ''} overdue
            </span>
          )}
        </div>

        <div className="my-6">
          <span className="text-5xl font-serif font-black text-ink select-all">₹{totalUnpaid.toFixed(2)}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-edge/20">
          <p className="text-[11px] text-muted max-w-sm">
            All unpaid balances must be cleared to keep your borrowing privileges active.
          </p>
          {totalUnpaid > 0 && (
            <Button
              ref={payAllBtnRef}
              variant="primary"
              onClick={() => onPayAllTrigger(payAllBtnRef)}
              className="text-xs px-5 h-9 font-bold shrink-0"
              aria-label="Pay all outstanding balance"
            >
              Pay All Balance
            </Button>
          )}
        </div>
      </div>

      {/* Coupons / Office Info Card */}
      <div className="glass-panel border border-edge/30 rounded-2xl p-6 flex flex-col justify-between shadow-sm bg-gradient-to-br from-surface/40 to-deep/45">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Ticket size={16} className="text-indigo" />
            Waiver Coupons
          </h3>
          <p className="text-xs text-muted mt-1">Use coupons to instantly waive late return fees.</p>

          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-indigo/5 border border-indigo/20">
            <span className="text-3xl font-bold font-serif text-indigo">{userCoupons}</span>
            <div className="text-[10px] text-indigo/90 font-semibold leading-tight">
              Coupons available in your account
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-edge/20">
          <h4 className="text-xs font-bold text-ink flex items-center gap-1 mb-2">
            <AlertTriangle size={14} className="text-ember-glow" />
            Payment Policies
          </h4>
          <p className="text-[10px] text-muted leading-relaxed">
            Need to pay cash or appeal a fine? Visit the college finance office at Admin Block, Ground Floor (Mon-Fri 9AM-4PM).
          </p>
        </div>
      </div>
    </div>
  );
};
