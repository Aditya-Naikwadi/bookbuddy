import { HelpCircle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../../ui/Button';

export const QueueHoldsList = ({ queue, onCancelHoldTrigger, isCancelling, cancellingHoldId }) => {
  if (queue.length === 0) {
    return (
      <div className="text-center py-8 flex flex-col items-center">
        <HelpCircle className="text-muted/40 mb-2" size={30} />
        <p className="text-xs text-muted">You are not currently in any reservation waitlists.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => {
        const isCurrentCancelling = isCancelling && cancellingHoldId === item._id;

        return (
          <div
            key={item._id}
            className="flex items-center justify-between p-4 border border-edge/30 bg-surface/20 rounded-xl hover:border-edge/50 transition-colors"
          >
            <div className="min-w-0">
              <h4 className="font-bold text-ink text-sm leading-tight truncate max-w-[200px] sm:max-w-[350px]">
                {item.bookId?.title || 'Library Book'}
              </h4>
              <p className="text-[10px] text-muted mt-1 uppercase tracking-wider font-semibold">
                Status: {item.status ? item.status.replace('_', ' ') : 'Queued'}
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="block text-2xl font-serif font-black text-ember leading-none">
                  #{item.queuePosition}
                </span>
                <span className="text-[9px] text-muted uppercase tracking-wider font-bold">in line</span>
              </div>

              <button
                disabled={isCancelling}
                onClick={() => {
                  if (window.confirm('Are you sure you want to cancel this reservation hold?')) {
                    onCancelHoldTrigger(item._id);
                  }
                }}
                className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={`Cancel hold for ${item.bookId?.title}`}
              >
                {isCurrentCancelling ? (
                  <Loader2 size={16} className="animate-spin text-danger" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
