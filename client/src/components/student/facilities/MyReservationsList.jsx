import { useState } from 'react';
import { Calendar, Clock, Trash2, Monitor, QrCode, X, ShieldCheck } from 'lucide-react';
import { Button } from '../../ui/Button';
import { QRCodeSVG } from 'qrcode.react';

export const MyReservationsList = ({
  bookings = [],
  onCancelRequest,
}) => {
  const [qrModalBooking, setQrModalBooking] = useState(null);

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
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
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
                className="p-4 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <Monitor size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                      Seat: {booking.seatId?.seatNumber || 'PC'}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {booking.seatId?.labName || 'Digital Library Lab'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                      <Calendar size={13} className="text-slate-400" />
                      <span>{formatLocalDate(booking.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                      <Clock size={13} className="text-slate-400" />
                      <span>{timeRange}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setQrModalBooking(booking)}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                  >
                    <QrCode size={14} />
                    <span>Kiosk Pass</span>
                  </button>

                  <Button
                    onClick={() => onCancelRequest(booking)}
                    variant="ghost"
                    className="h-9 px-3 rounded-xl border border-red-200/50 hover:bg-red-50 text-red-600 text-xs font-bold flex items-center gap-1"
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

      {/* Kiosk Scan-in QR Confirmation Modal */}
      {qrModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-500" />
                Lab Kiosk Scan-In Pass
              </h4>
              <button onClick={() => setQrModalBooking(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Scan this QR code at the lab kiosk terminal to log into workstation seat{' '}
              <strong className="text-slate-800 dark:text-white font-mono">{qrModalBooking.seatId?.seatNumber}</strong>.
            </p>

            <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-200 inline-block">
              <QRCodeSVG
                value={JSON.stringify({
                  bookingId: qrModalBooking._id,
                  seatNumber: qrModalBooking.seatId?.seatNumber,
                  verificationToken: `VERIFY-${qrModalBooking._id}-${qrModalBooking.createdAt || qrModalBooking._id}`,
                })}
                size={160}
                level="H"
                fgColor="#0d111a"
                bgColor="#ffffff"
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] text-slate-500 font-mono">
              Token expires 15 minutes after slot start time.
            </div>

            <Button variant="ghost" className="w-full text-xs font-bold" onClick={() => setQrModalBooking(null)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyReservationsList;
