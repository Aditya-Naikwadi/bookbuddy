import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

export const SeatDayPlanner = ({
  seats = [],
  isLoading = false,
  onSelectSeat,
  onJoinWaitlist,
  weeklySeatHoursUsed = 0,
  maxSeatHours = 30,
  _userActiveQueue = [],
}) => {
  // Horizon is strictly today or tomorrow (§10.3)
  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("en-CA");
  }, []);
  const tomorrowFormatted = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Time slot hours
  const timeSlots = [
    { label: "08:00 - 09:00", start: "08:00", end: "09:00" },
    { label: "09:00 - 10:00", start: "09:00", end: "10:00" },
    { label: "10:00 - 11:00", start: "10:00", end: "11:00" },
    { label: "11:00 - 12:00", start: "11:00", end: "12:00" },
    { label: "13:00 - 14:00", start: "13:00", end: "14:00" },
    { label: "14:00 - 15:00", start: "14:00", end: "15:00" },
    { label: "15:00 - 16:00", start: "15:00", end: "16:00" },
    { label: "16:00 - 17:00", start: "16:00", end: "17:00" },
    { label: "17:00 - 18:00", start: "17:00", end: "18:00" },
    { label: "18:00 - 19:00", start: "18:00", end: "19:00" },
    { label: "19:00 - 20:00", start: "19:00", end: "20:00" },
    { label: "20:00 - 21:00", start: "20:00", end: "21:00" },
  ];

  const [selectedSlot, setSelectedSlot] = useState(timeSlots[1]);
  const [selectedSeat, setSelectedSeat] = useState(null);

  const seatQuotaRemainingHours = Math.max(
    0,
    maxSeatHours - Math.round((weeklySeatHoursUsed / 60) * 10) / 10,
  );
  const seatQuotaPercent = Math.min(
    100,
    Math.round((weeklySeatHoursUsed / (maxSeatHours * 60)) * 100),
  );

  const availableSeatsCount = seats.filter(
    (s) => s.status === "available" && !s.isBookedInSlot,
  ).length;
  const isSlotFull = seats.length > 0 && availableSeatsCount === 0;

  return (
    <div className="space-y-6">
      {/* Header Banner & Quota Meter */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
              <Calendar size={13} />
              <span>Day-Ahead Planner (Max 24h Horizon)</span>
            </div>
            <h2 className="text-2xl font-serif font-black tracking-tight">
              Quiet Study Seat Planner
            </h2>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Quiet reading desk spaces with natural lighting and power outlets.
              Bookable up to{" "}
              <strong className="text-white">1 day in advance</strong> for your
              dedicated study sessions.
            </p>
          </div>

          {/* Quota Gauge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl w-full md:w-64 shrink-0">
            <div className="flex justify-between items-center text-xs font-bold mb-1.5">
              <span className="text-slate-300">Seat Quota (30h Cap)</span>
              <span
                className={
                  seatQuotaPercent >= 90 ? "text-amber-300" : "text-indigo-300"
                }
              >
                {seatQuotaRemainingHours}h left
              </span>
            </div>
            <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  seatQuotaPercent >= 90
                    ? "bg-amber-400"
                    : "bg-gradient-to-r from-indigo-400 to-cyan-400"
                }`}
                style={{ width: `${seatQuotaPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Independent from your 12h PC workstation quota.
            </p>
          </div>
        </div>

        {/* Date Selector Buttons */}
        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-white/10">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
            Booking Day:
          </span>
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              selectedDate === todayStr
                ? "bg-white text-slate-900 shadow-sm"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            Today (
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            )
          </button>
          <button
            onClick={() => setSelectedDate(tomorrowStr)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              selectedDate === tomorrowStr
                ? "bg-white text-slate-900 shadow-sm"
                : "bg-white/10 text-slate-300 hover:bg-white/20"
            }`}
          >
            Tomorrow ({tomorrowFormatted})
          </button>
        </div>
      </div>

      {/* Time Slot Picker Carousel/Chips */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock size={14} className="text-indigo-600" />
            <span>Select Desired Slot</span>
          </h4>
          <span className="text-xs text-slate-500 font-medium">
            {availableSeatsCount} of {seats.length} seats free in this slot
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {timeSlots.map((slot) => {
            const isSelected = selectedSlot.start === slot.start;
            return (
              <button
                key={slot.start}
                onClick={() => {
                  setSelectedSlot(slot);
                  setSelectedSeat(null);
                }}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* BookMyShow Style Seat Map Grid */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-serif font-bold text-slate-900">
              Quiet Reading Hall A — Seat Map
            </h3>
            <p className="text-xs text-slate-400">
              Click any available desk to reserve your space.
            </p>
          </div>

          {/* Map Legend */}
          <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-lg border-2 border-emerald-500 bg-emerald-50" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-lg border-2 border-indigo-600 bg-indigo-600" />
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-lg border border-slate-300 bg-slate-200" />
              <span>Booked</span>
            </div>
          </div>
        </div>

        {/* Visual Desks Display */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            Loading seat availability...
          </div>
        ) : seats.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No study seats available for this hall.
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 pt-2">
            {seats.map((seat) => {
              const isSelected = selectedSeat?._id === seat._id;
              const isBooked =
                seat.isBookedInSlot || seat.status !== "available";

              return (
                <button
                  key={seat._id}
                  disabled={isBooked}
                  onClick={() => setSelectedSeat(seat)}
                  className={`h-14 rounded-2xl border-2 flex flex-col items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-md scale-105"
                      : isBooked
                        ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                        : "border-emerald-400 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-900 hover:scale-102"
                  }`}
                  aria-label={`Seat ${seat.label} - ${isBooked ? "Booked" : "Available"}`}
                >
                  <BookOpen
                    size={14}
                    className={
                      isSelected
                        ? "text-white"
                        : isBooked
                          ? "text-slate-400"
                          : "text-emerald-600"
                    }
                  />
                  <span className="text-[11px] font-mono font-black mt-1">
                    {seat.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Seat Confirmation & Waitlist Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-500">
            {selectedSeat ? (
              <span>
                Selected:{" "}
                <strong className="text-slate-900 font-bold">
                  {selectedSeat.label}
                </strong>{" "}
                on{" "}
                <strong className="text-slate-900 font-bold">
                  {selectedDate}
                </strong>{" "}
                ({selectedSlot.label})
              </span>
            ) : isSlotFull ? (
              <span className="text-amber-600 font-bold flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>
                  All seats in this slot are currently reserved. You can join
                  the waitlist!
                </span>
              </span>
            ) : (
              <span>Select a free desk above to proceed with booking.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isSlotFull && (
              <button
                onClick={() =>
                  onJoinWaitlist({
                    date: selectedDate,
                    slotStart: `${selectedDate}T${selectedSlot.start}:00.000Z`,
                    slotEnd: `${selectedDate}T${selectedSlot.end}:00.000Z`,
                  })
                }
                className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Users size={14} />
                <span>Join Waitlist for This Slot</span>
              </button>
            )}

            <button
              disabled={!selectedSeat}
              onClick={() =>
                onSelectSeat({
                  seat: selectedSeat,
                  date: selectedDate,
                  slotStart: `${selectedDate}T${selectedSlot.start}:00.000Z`,
                  slotEnd: `${selectedDate}T${selectedSlot.end}:00.000Z`,
                })
              }
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <span>Confirm Seat Reservation</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
