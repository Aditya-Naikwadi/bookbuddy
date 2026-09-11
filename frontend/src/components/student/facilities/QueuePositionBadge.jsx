import { useState, useEffect } from "react";
import { Users, CheckCircle, ArrowRight, X } from "lucide-react";

export const QueuePositionBadge = ({
  tickets = [],
  onClaim,
  onLeave,
  isClaiming,
  isLeaving,
}) => {
  if (!tickets || tickets.length === 0) return null;

  return (
    <div
      className="space-y-3"
      role="region"
      aria-label="Active Queue Reservations"
    >
      {tickets.map((ticket) => (
        <QueueTicketCard
          key={ticket._id}
          ticket={ticket}
          onClaim={onClaim}
          onLeave={onLeave}
          isClaiming={isClaiming}
          isLeaving={isLeaving}
        />
      ))}
    </div>
  );
};

const QueueTicketCard = ({
  ticket,
  onClaim,
  onLeave,
  isClaiming,
  isLeaving,
}) => {
  const isReady = ticket.status === "ready_to_confirm";
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    if (!ticket.expiresAt) return 0;
    const diff = Math.floor(
      (new Date(ticket.expiresAt).getTime() - Date.now()) / 1000,
    );
    return Math.max(0, diff);
  });

  useEffect(() => {
    if (!isReady || !ticket.expiresAt) return;
    const timer = setInterval(() => {
      const diff = Math.floor(
        (new Date(ticket.expiresAt).getTime() - Date.now()) / 1000,
      );
      setSecondsRemaining(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(timer);
  }, [isReady, ticket.expiresAt]);

  const formatCountdown = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const groupName = ticket.resourceGroupId?.name || "Facility Slot";
  const resourceType =
    ticket.resourceGroupId?.type === "workstation"
      ? "PC Workstation"
      : "Study Seat";
  const slotFormatted = new Date(ticket.slotStart).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isReady) {
    return (
      <div className="p-4 rounded-3xl border-2 border-emerald-500 bg-emerald-50 text-emerald-950 shadow-md animate-in slide-in-from-top-2 duration-300 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                  Slot Available to Claim!
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  Expires in {formatCountdown(secondsRemaining)}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 mt-0.5">
                {groupName} ({slotFormatted})
              </h4>
              <p className="text-xs text-slate-600">
                A {resourceType.toLowerCase()} opened up! Claim it now before it
                is offered to the next student in line.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onClaim(ticket._id)}
              disabled={isClaiming || secondsRemaining <= 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
            >
              <span>{isClaiming ? "Claiming..." : "Claim Slot Now"}</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => onLeave(ticket._id)}
              disabled={isLeaving}
              className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-emerald-100 transition-colors"
              aria-label="Decline and leave queue"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/60 text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <Users size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
              Queue Position #{ticket.queuePosition}
            </span>
            <span className="text-xs text-slate-600">
              {ticket.aheadCount === 0
                ? "You're next in line!"
                : `${ticket.aheadCount} person ahead of you`}
            </span>
          </div>
          <p className="text-xs text-slate-700 font-medium mt-0.5">
            {groupName} • Slot at {slotFormatted}
          </p>
        </div>
      </div>

      <button
        onClick={() => onLeave(ticket._id)}
        disabled={isLeaving}
        className="text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors shrink-0"
      >
        Leave Queue
      </button>
    </div>
  );
};
