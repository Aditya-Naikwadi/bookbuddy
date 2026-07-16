import React from 'react';
import { Calendar, Clock, Trash2, Monitor } from 'lucide-react';
import { Button } from '../../ui/Button';

export const MyReservationsList = ({
  bookings = [],
  onCancelRequest,
}) => {
  // Filter active/booked bookings
  const activeBookings = bookings.filter((b) => b.status === 'booked');

  const formatLocalDate = (dateVal) => {
    const d = new Date(dateVal);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };

  const formatLocalTime = (timeVal) => {
    const d = new Date(timeVal);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Monitor className="text-indigo-600 w-4 h-4" />
          My Workstation Bookings
        </h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Active Limit: 1
        </span>
      </div>

      {activeBookings.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs">
          You have no active workstation reservations.
        </div>
      ) : (
        <div className="space-y-3">
          {activeBookings.map((booking) => {
            const timeRange = `${formatLocalTime(booking.startTime)} - ${formatLocalTime(booking.endTime)}`;

            return (
              <div
                key={booking._id}
                className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <Monitor size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">
                      Seat: {booking.seatId?.seatNumber || 'PC'}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {booking.seatId?.labName || 'Digital Library Lab'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Calendar size={13} className="text-slate-400" />
                      <span>{formatLocalDate(booking.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Clock size={13} className="text-slate-400" />
                      <span>{timeRange}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => onCancelRequest(booking)}
                    variant="ghost"
                    className="h-9 px-3 rounded-xl border border-red-200/50 hover:bg-red-50 text-red-600 text-xs font-bold flex items-center gap-1 focus:ring-2 focus:ring-red-500 focus:outline-none"
                    aria-label={`Cancel reservation for workstation ${booking.seatId?.seatNumber}`}
                  >
                    <Trash2 size={13} />
                    <span>Cancel</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyReservationsList;
