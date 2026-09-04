import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Monitor, AlertTriangle } from "lucide-react";
import { useReducedMotion } from "../../../hooks/useReducedMotion";

export const ActiveReservationBanner = ({ bookings = [] }) => {
  const activeBooking = bookings.find((b) => b.status === "booked");
  const prefersReducedMotion = useReducedMotion();
  const [minsRemaining, setMinsRemaining] = useState(60);

  useEffect(() => {
    if (!activeBooking?.endTime) return;
    const calculateTime = () => {
      const end = new Date(activeBooking.endTime).getTime();
      const now = new Date().getTime();
      const diffMins = Math.max(0, Math.ceil((end - now) / (1000 * 60)));
      setMinsRemaining(diffMins);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 30000);
    return () => clearInterval(interval);
  }, [activeBooking]);

  if (!activeBooking) return null;

  const formatLocalDate = (dateVal) => {
    const d = new Date(dateVal);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  const formatLocalTime = (timeVal) => {
    const d = new Date(timeVal);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  };

  const timeRange = `${formatLocalTime(activeBooking.startTime)} - ${formatLocalTime(activeBooking.endTime)}`;
  const isExpiringSoon = minsRemaining <= 15;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full shadow-sm border transition-colors ${
        isExpiringSoon
          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
          : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-slate-900 dark:text-ink"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white ${
            isExpiringSoon ? "bg-amber-500" : "bg-indigo-600"
          }`}
        >
          {isExpiringSoon ? (
            <AlertTriangle size={20} className="animate-bounce" />
          ) : (
            <Monitor size={20} className="animate-pulse" />
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-ink flex items-center gap-2">
            <span>
              Active Reserved Seat: {activeBooking.seatId?.seatNumber || "PC"}
            </span>
            {isExpiringSoon && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-black animate-pulse">
                Expiring Soon!
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-600 dark:text-muted font-medium mt-0.5">
            Check into your workstation at{" "}
            {activeBooking.seatId?.labName || "Central Computing Lab"}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
        <div className="flex items-center gap-1">
          <Calendar size={13} />
          <span>{formatLocalDate(activeBooking.date)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={13} />
          <span>{timeRange}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default ActiveReservationBanner;
