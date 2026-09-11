import { useState, useEffect, useMemo, useCallback } from "react";
import { useAvailability } from "../../../hooks/useAvailability";
import { useReservation } from "../../../hooks/useReservation";
import { ReservationModal } from "../../../components/student/facilities/ReservationModal";
import { CancelModal } from "../../../components/student/facilities/CancelModal";
import { MyReservationsList } from "../../../components/student/facilities/MyReservationsList";
import { ActiveReservationBanner } from "../../../components/student/facilities/ActiveReservationBanner";
import { LiveWorkstationBoard } from "../../../components/student/facilities/LiveWorkstationBoard";
import { SeatDayPlanner } from "../../../components/student/facilities/SeatDayPlanner";
import { QueuePositionBadge } from "../../../components/student/facilities/QueuePositionBadge";
import facilitiesApi from "../../../api/facilitiesApi";
import { useSocket } from "../../../hooks/useSocket";
import { AlertCircle, Monitor, BookOpen, Layers } from "lucide-react";

const LabBooking = () => {
  const [labName] = useState("Central Computing Lab");

  // Facility View Mode: 'workstation' (Short-Horizon Live Board) vs 'seat' (Day-Ahead Planner) (§10.3 & §12)
  const [facilityMode, setFacilityMode] = useState("workstation");

  // Set default date to today (YYYY-MM-DD) in local browser perspective
  const [selectedDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString("en-CA");
  });

  // State managers for overlays
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Queue state (§10.4 & §11)
  const [queueTickets, setQueueTickets] = useState([]);
  const [isClaimingQueue, setIsClaimingQueue] = useState(false);
  const [isLeavingQueue, setIsLeavingQueue] = useState(false);

  // 1. Fetch live availability
  const {
    availability,
    isLoading: loadingAvailability,
    refetch: refetchAvailability,
  } = useAvailability(labName, selectedDate);

  // 2. Fetch student bookings and mutation actions
  const {
    myBookings,
    loadingMyBookings,
    createBooking,
    isCreating,
    cancelBooking,
    isCancelling,
    checkInBooking,
    liveAnnouncement,
  } = useReservation();

  // 3. Fetch active queue tickets
  const fetchQueueTickets = useCallback(async () => {
    try {
      const tickets = await facilitiesApi.getMyQueue();
      setQueueTickets(tickets || []);
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadTickets = async () => {
      try {
        const tickets = await facilitiesApi.getMyQueue();
        if (mounted) setQueueTickets(tickets || []);
      } catch {
        // Graceful fallback
      }
    };
    loadTickets();
    return () => {
      mounted = false;
    };
  }, []);

  // 4. Realtime Socket.io synchronizer for queue & releases (§10.4)
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeUpdate = () => {
      fetchQueueTickets();
      refetchAvailability();
    };

    socket.on("facility:queue_promoted", handleRealtimeUpdate);
    socket.on("facility:queue_updated", handleRealtimeUpdate);
    socket.on("facility:slot_released", handleRealtimeUpdate);
    socket.on("facility:slot_booked", handleRealtimeUpdate);

    return () => {
      socket.off("facility:queue_promoted", handleRealtimeUpdate);
      socket.off("facility:queue_updated", handleRealtimeUpdate);
      socket.off("facility:slot_released", handleRealtimeUpdate);
      socket.off("facility:slot_booked", handleRealtimeUpdate);
    };
  }, [socket, fetchQueueTickets, refetchAvailability]);

  const handleCheckIn = async (booking) => {
    setErrorMessage("");
    try {
      await checkInBooking(booking._id);
    } catch (err) {
      setErrorMessage(err.message || "Failed to check in.");
    }
  };

  // Queue interactions
  const handleClaimQueue = async (queueId) => {
    setIsClaimingQueue(true);
    setErrorMessage("");
    try {
      await facilitiesApi.claimQueueSpot(queueId);
      await fetchQueueTickets();
      await refetchAvailability();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Failed to claim promoted slot.",
      );
    } finally {
      setIsClaimingQueue(false);
    }
  };

  const handleLeaveQueue = async (queueId) => {
    setIsLeavingQueue(true);
    try {
      await facilitiesApi.leaveQueue(queueId);
      await fetchQueueTickets();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || "Failed to leave queue.",
      );
    } finally {
      setIsLeavingQueue(false);
    }
  };

  const handleJoinQueue = async (station) => {
    setErrorMessage("");
    try {
      const now = new Date();
      const slotStart = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
      const slotEnd = new Date(now.getTime() + 65 * 60 * 1000).toISOString();

      await facilitiesApi.joinQueue({
        resourceGroupId: station.groupId,
        resourceId: station._id,
        date: selectedDate,
        slotStart,
        slotEnd,
      });
      await fetchQueueTickets();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || "Could not join queue.",
      );
    }
  };

  // Helper to check time slot overlap
  const isTimeOverlap = (startA, endA, startB, endB) => {
    if (!startA || !endA || !startB || !endB) return false;
    return (
      new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB)
    );
  };

  // Handle slot reservation confirmation
  const handleConfirmReservation = async () => {
    if (!selectedSlot) return;
    setErrorMessage("");

    const existingOverlap = myBookings?.find(
      (b) =>
        (b.status === "booked" || b.status === "confirmed") &&
        isTimeOverlap(
          b.startTime,
          b.endTime,
          selectedSlot.startTime,
          selectedSlot.endTime,
        ),
    );

    if (existingOverlap) {
      setErrorMessage(
        `Double-Booking Prevention: You already hold an active reservation during this overlapping time slot.`,
      );
      return;
    }

    try {
      await createBooking({
        seatId: selectedSlot.seatId,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });
      setSelectedSlot(null);
    } catch (err) {
      if (err.response?.status === 409 || err.status === 409) {
        setErrorMessage(
          err.response?.data?.message ||
            "409 Conflict: This slot has already been reserved concurrently.",
        );
      } else {
        setErrorMessage(
          err.message || "Failed to complete reservation. Please try again.",
        );
      }
    }
  };

  // Handle booking cancellation confirmation
  const handleConfirmCancellation = () => {
    if (!cancellingBooking) return;
    cancelBooking(cancellingBooking._id, {
      onSuccess: () => {
        setCancellingBooking(null);
        refetchAvailability();
        fetchQueueTickets();
      },
    });
  };

  // Workstation mapping for LiveWorkstationBoard
  const workstations = useMemo(() => {
    if (!availability?.seats) return [];
    return availability.seats.map((seat) => ({
      _id: seat._id,
      label: seat.seatNumber || `PC-${seat._id.slice(-2)}`,
      groupId: seat.groupId || "6aa115f8b9b09f1b15884a01",
      groupName: seat.labName || "Central Computing Lab",
      status: seat.status || "available",
      isCurrentlyBooked: seat.isBooked || seat.status === "booked",
      specs: seat.specs || "Equipped Workstation • High-Speed LAN",
    }));
  }, [availability]);

  // Study Seat mapping for SeatDayPlanner
  const studySeats = useMemo(() => {
    if (!availability?.seats) return [];
    return availability.seats.map((seat) => ({
      _id: seat._id,
      label:
        seat.seatNumber?.replace("PC-", "S-") || `Seat-${seat._id.slice(-2)}`,
      status: seat.status || "available",
      isBookedInSlot: seat.isBooked || seat.status === "booked",
    }));
  }, [availability]);

  const formattedDateLabel = new Date(selectedDate).toLocaleDateString(
    undefined,
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    },
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-4">
      {/* Screen Reader Live Status Region */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveAnnouncement}
      </div>

      {/* Page Heading & Surface Mode Switcher (§10.3 & §12) */}
      <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">
            Facility & Lab Booking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Reserve individual PC workstations or quiet study seats across
            campus libraries.
          </p>
        </div>

        {/* Dual-Horizon Surface Selector */}
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200/80 shadow-xs">
          <button
            onClick={() => setFacilityMode("workstation")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              facilityMode === "workstation"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Monitor
              size={15}
              className={
                facilityMode === "workstation" ? "text-indigo-600" : ""
              }
            />
            <span>Workstations (Live ≤1h)</span>
          </button>
          <button
            onClick={() => setFacilityMode("seat")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              facilityMode === "seat"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BookOpen
              size={15}
              className={facilityMode === "seat" ? "text-indigo-600" : ""}
            />
            <span>Study Seats (Day-Ahead)</span>
          </button>
        </div>
      </div>

      {/* Active Promotion & Queue Ticket Alerts (§10.4 & §11) */}
      <QueuePositionBadge
        tickets={queueTickets}
        onClaim={handleClaimQueue}
        onLeave={handleLeaveQueue}
        isClaiming={isClaimingQueue}
        isLeaving={isLeavingQueue}
      />

      {/* Active reservation top summary banner */}
      <ActiveReservationBanner
        bookings={myBookings}
        onCheckIn={handleCheckIn}
      />

      {/* Error / Alert Message Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage("")}
            className="text-red-500 hover:text-red-700 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Columns: Dynamic UI Surface */}
        <div className="lg:col-span-2 space-y-6">
          {facilityMode === "workstation" ? (
            <LiveWorkstationBoard
              workstations={workstations}
              isLoading={loadingAvailability}
              onSelectWorkstation={(station) => {
                setSelectedSlot({
                  seatId: station._id,
                  seatNumber: station.label,
                  startTime: new Date().toISOString(),
                  endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                });
              }}
              onJoinQueue={handleJoinQueue}
              weeklyPcHoursUsed={120}
              maxPcHours={12}
              userActiveQueue={queueTickets}
            />
          ) : (
            <SeatDayPlanner
              seats={studySeats}
              isLoading={loadingAvailability}
              onSelectSeat={({ seat, slotStart, slotEnd }) => {
                setSelectedSlot({
                  seatId: seat._id,
                  seatNumber: seat.label,
                  startTime: slotStart,
                  endTime: slotEnd,
                });
              }}
              onJoinWaitlist={async ({ slotStart, slotEnd }) => {
                try {
                  await facilitiesApi.joinQueue({
                    resourceGroupId: "6aa115f8b9b09f1b15884a02",
                    date: selectedDate,
                    slotStart,
                    slotEnd,
                  });
                  await fetchQueueTickets();
                } catch (err) {
                  setErrorMessage(
                    err.response?.data?.message ||
                      err.message ||
                      "Failed to join waitlist.",
                  );
                }
              }}
              weeklySeatHoursUsed={180}
              maxSeatHours={30}
              userActiveQueue={queueTickets}
            />
          )}
        </div>

        {/* Right Column: Student Bookings History & Policies */}
        <div className="space-y-6">
          {loadingMyBookings ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Loading active bookings...
            </div>
          ) : (
            <MyReservationsList
              bookings={myBookings}
              onCancelRequest={setCancellingBooking}
              onCheckInRequest={handleCheckIn}
            />
          )}

          {/* Unified Fair Booking Policies Box (§10.5) */}
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-600" />
              <span>Fairness & Quota Policies</span>
            </h4>
            <ul className="text-[10px] text-slate-600 space-y-2 list-disc list-inside leading-relaxed font-medium">
              <li>
                <strong>Independent Weekly Quotas:</strong> 12 hours for PCs and
                30 hours for Study Seats.
              </li>
              <li>
                <strong>10-Minute Grace Period:</strong> Check in within 10
                minutes of slot start or your slot is auto-released as a
                no-show.
              </li>
              <li>
                <strong>1-Hour Cancellation Notice:</strong> Cancel ≥ 1 hour in
                advance for a 100% quota refund. Under 1 hour notice forfeits
                the slot duration from your weekly cap.
              </li>
              <li>
                <strong>Automatic Promotion:</strong> Waitlisted patrons receive
                a 10-minute priority window to claim freed slots.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation Overlays */}
      <ReservationModal
        slot={selectedSlot}
        dateLabel={formattedDateLabel}
        isPending={isCreating}
        errorMessage={errorMessage}
        onConfirm={handleConfirmReservation}
        onClose={() => {
          setSelectedSlot(null);
          setErrorMessage("");
        }}
      />

      <CancelModal
        booking={cancellingBooking}
        isPending={isCancelling}
        onConfirm={handleConfirmCancellation}
        onClose={() => setCancellingBooking(null)}
      />
    </div>
  );
};

export default LabBooking;
