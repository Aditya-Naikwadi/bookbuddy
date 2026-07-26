import { useRef } from "react";
import { Monitor, Hammer, ShieldAlert, Check } from "lucide-react";

export const WorkstationGrid = ({
  availability = [],
  selectedSlot = null,
  onSelectSlot,
  hasActiveBooking = false,
}) => {
  const containerRef = useRef(null);

  // Helper to format slot times nicely (e.g., "8:00 AM - 9:00 AM")
  const formatTimeSlot = (startTimeISO) => {
    const d = new Date(startTimeISO);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  };

  // Keyboard navigation handler for the grid structure
  const handleKeyDown = (e, seatIndex, slotIndex, totalSeats, totalSlots) => {
    let nextRow = seatIndex;
    let nextCol = slotIndex;

    switch (e.key) {
      case "ArrowRight":
        nextCol = (slotIndex + 1) % totalSlots;
        e.preventDefault();
        break;
      case "ArrowLeft":
        nextCol = (slotIndex - 1 + totalSlots) % totalSlots;
        e.preventDefault();
        break;
      case "ArrowDown":
        nextRow = (seatIndex + 1) % totalSeats;
        e.preventDefault();
        break;
      case "ArrowUp":
        nextRow = (seatIndex - 1 + totalSeats) % totalSeats;
        e.preventDefault();
        break;
      case "Escape":
        onSelectSlot(null); // Deselect
        e.preventDefault();
        break;
      default:
        return; // Exit for unhandled keys
    }

    // Locate and focus the target button
    const targetSelector = `[data-seat-idx="${nextRow}"][data-slot-idx="${nextCol}"]`;
    const targetElement = containerRef.current?.querySelector(targetSelector);
    if (targetElement) {
      targetElement.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className="space-y-6 w-full"
      role="region"
      aria-label="Workstation reservation grid"
    >
      {availability.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No workstation slots found for this date.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {availability.map((item, seatIdx) => {
            const { seat, slots = [] } = item;
            const isMaintenance = seat.maintenanceStatus !== "operational";

            return (
              <div
                key={seat._id}
                className={`p-5 rounded-3xl border transition-all ${
                  isMaintenance
                    ? "bg-slate-50/50 border-slate-100 opacity-60"
                    : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isMaintenance
                          ? "bg-amber-50 text-amber-500"
                          : "bg-indigo-50 text-indigo-600"
                      }`}
                    >
                      {isMaintenance ? (
                        <Hammer size={20} />
                      ) : (
                        <Monitor size={20} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        {seat.seatNumber}
                        {isMaintenance && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Maintenance
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {seat.specs || "Standard Lab Client"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Slots container */}
                {isMaintenance ? (
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold p-3 bg-amber-50 rounded-2xl border border-amber-100">
                    <ShieldAlert size={16} />
                    <span>
                      This workstation is temporarily out of service.
                      Reservations are disabled.
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {slots.map((slot, slotIdx) => {
                      const isBooked = !slot.isAvailable;
                      const isSelected =
                        selectedSlot &&
                        selectedSlot.seatId === seat._id &&
                        selectedSlot.startTime === slot.startTime;

                      const timeStr = `${formatTimeSlot(slot.startTime)} - ${formatTimeSlot(slot.endTime)}`;

                      let btnStyle =
                        "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 bg-white";
                      let ariaLabelText = `${seat.seatNumber}, Timeslot ${timeStr}, Available`;

                      if (isBooked) {
                        btnStyle =
                          "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed";
                        ariaLabelText = `${seat.seatNumber}, Timeslot ${timeStr}, Already Reserved`;
                      } else if (isSelected) {
                        btnStyle =
                          "bg-indigo border-indigo text-white shadow-sm shadow-indigo-500/25";
                        ariaLabelText = `${seat.seatNumber}, Timeslot ${timeStr}, Selected for Booking`;
                      }

                      return (
                        <button
                          key={slot.startTime}
                          data-seat-idx={seatIdx}
                          data-slot-idx={slotIdx}
                          onClick={() => {
                            if (!isBooked && !hasActiveBooking) {
                              onSelectSlot({
                                seatId: seat._id,
                                seatNumber: seat.seatNumber,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                                timeLabel: timeStr,
                              });
                            }
                          }}
                          onKeyDown={(e) =>
                            handleKeyDown(
                              e,
                              seatIdx,
                              slotIdx,
                              availability.length,
                              slots.length,
                            )
                          }
                          disabled={isBooked || hasActiveBooking}
                          className={`h-11 rounded-2xl border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-600/50 ${btnStyle}`}
                          aria-label={ariaLabelText}
                          aria-pressed={isSelected}
                          aria-disabled={isBooked}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                          <span>{formatTimeSlot(slot.startTime)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkstationGrid;
