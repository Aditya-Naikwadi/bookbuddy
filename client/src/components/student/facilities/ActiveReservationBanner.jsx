import { Calendar, Clock, Monitor } from 'lucide-react';

export const ActiveReservationBanner = ({ bookings = [] }) => {
  const activeBooking = bookings.find((b) => b.status === 'booked');

  if (!activeBooking) return null;

  const formatLocalDate = (dateVal) => {
    const d = new Date(dateVal);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const formatLocalTime = (timeVal) => {
    const d = new Date(timeVal);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  const timeRange = `${formatLocalTime(activeBooking.startTime)} - ${formatLocalTime(activeBooking.endTime)}`;

  return (
    <div
      className="bg-indigo-50 border border-indigo-150 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shrink-0">
          <Monitor size={20} className="animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-800">
            Active Booking Reserved: {activeBooking.seatId?.seatNumber || 'PC'}
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            Remember to check into your workstation at {activeBooking.seatId?.labName || 'Central Computing Lab'}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-bold text-indigo shrink-0">
        <div className="flex items-center gap-1">
          <Calendar size={13} />
          <span>{formatLocalDate(activeBooking.date)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={13} />
          <span>{timeRange}</span>
        </div>
      </div>
    </div>
  );
};

export default ActiveReservationBanner;
