import { useState, useEffect } from "react";
import { HelpCircle, Trash2, Loader2, Sparkles, Clock } from "lucide-react";
import { StatusBadge } from "../../common/StatusBadge";

export const QueueHoldsList = ({
  queue,
  onCancelHoldTrigger,
  isCancelling,
  cancellingHoldId,
}) => {
  const [now, setNow] = useState(() => Date.now());

  // Update countdown every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const formatExpiresCountdown = (expiresAt) => {
    if (!expiresAt) return "Within 48 hours";
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "Pickup window expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left to pickup`;
    return `${minutes}m left to pickup`;
  };

  if (queue.length === 0) {
    return (
      <div className="text-center py-8 flex flex-col items-center">
        <HelpCircle className="text-muted/40 mb-2" size={30} />
        <p className="text-xs text-muted">
          You are not currently in any reservation waitlists.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => {
        const isCurrentCancelling =
          isCancelling && cancellingHoldId === item._id;
        const isReady = item.status === "ready_for_pickup";

        return (
          <div
            key={item._id}
            className={`flex items-center justify-between p-4 border rounded-xl transition-all ${
              isReady
                ? "bg-emerald-500/10 border-emerald-500/30 shadow-sm"
                : "bg-surface/20 border-edge/30 hover:border-edge/50"
            }`}
          >
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-ink text-sm leading-tight truncate max-w-[200px] sm:max-w-[350px]">
                  {item.bookId?.title || "Library Book"}
                </h4>
                {isReady && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase animate-pulse">
                    <Sparkles size={10} />
                    Ready for Pickup
                  </span>
                )}
              </div>

              {isReady ? (
                <div className="flex items-center gap-1 text-[11px] text-emerald-300 font-medium mt-1">
                  <Clock size={12} />
                  <span>{formatExpiresCountdown(item.expiresAt)}</span>
                </div>
              ) : (
                <p className="text-[10px] text-muted mt-1 uppercase tracking-wider font-semibold">
                  Status:{" "}
                  {item.status ? item.status.replace("_", " ") : "Queued"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                {isReady ? (
                  <StatusBadge
                    status="ready_for_pickup"
                    label="Pickup Ready"
                    size="sm"
                    showIcon
                  />
                ) : (
                  <>
                    <span className="block text-2xl font-serif font-black text-ember leading-none">
                      #{item.queuePosition}
                    </span>
                    <span className="text-[9px] text-muted uppercase tracking-wider font-bold">
                      in line
                    </span>
                  </>
                )}
              </div>

              <button
                disabled={isCancelling}
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to cancel this reservation hold?",
                    )
                  ) {
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

export default QueueHoldsList;
