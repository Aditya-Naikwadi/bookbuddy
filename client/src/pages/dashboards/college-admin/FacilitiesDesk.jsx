import { Monitor, Calendar, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function FacilitiesDesk() {
  const { data: seatsData, isLoading: isLoadingSeats } = useQuery({
    queryKey: ["labSeats"],
    queryFn: () => collegeAdminApi.getLabSeats(),
  });

  const { data: bookingsData, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["labBookings"],
    queryFn: () => collegeAdminApi.getLabBookings(),
  });

  const seats = seatsData?.data || [];
  const bookings = bookingsData?.data || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      <div className="border-b border-slate-800 pb-6">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
          Facilities & Workstations
        </span>
        <h1 className="text-3xl font-serif font-bold text-white mt-1">
          Lab Workstation Grid & Bookings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage campus lab workstations, seat maintenance statuses, and student time-slot reservations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seats Summary */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Monitor className="text-indigo-400" size={20} />
            Workstation Grid ({seats.length} Seats)
          </h3>
          {isLoadingSeats ? (
            <div className="py-6 text-center text-slate-400">Loading lab seats...</div>
          ) : seats.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No lab seats configured.
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {seats.map((seat) => (
                <div
                  key={seat._id}
                  className={`p-2.5 rounded-xl border text-center font-mono text-xs ${
                    seat.status === "available"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-slate-950 border-slate-800 text-slate-500"
                  }`}
                >
                  <div className="font-bold">{seat.seatNumber}</div>
                  <div className="text-[9px] capitalize">{seat.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bookings Table */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="text-amber-400" size={20} />
            Active Seat Reservations ({bookings.length})
          </h3>
          {isLoadingBookings ? (
            <div className="py-6 text-center text-slate-400">Loading lab bookings...</div>
          ) : bookings.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No active workstation bookings recorded.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {bookings.map((b) => (
                <div key={b._id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex justify-between">
                  <div>
                    <div className="font-bold text-white">{b.userId?.name || "Student"}</div>
                    <div className="text-slate-400 font-mono">Seat #{b.seatNumber || b.seatId?.seatNumber}</div>
                  </div>
                  <div className="text-right font-mono text-indigo-300">
                    <div>{b.slotTime}</div>
                    <div className="text-[10px] text-slate-400">{b.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
