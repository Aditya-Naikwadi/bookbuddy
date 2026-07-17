import { useState, useEffect } from 'react';
import { useAvailability } from '../../../hooks/useAvailability';
import { useReservation } from '../../../hooks/useReservation';
import { WorkstationGrid } from '../../../components/student/facilities/WorkstationGrid';
import { ReservationModal } from '../../../components/student/facilities/ReservationModal';
import { CancelModal } from '../../../components/student/facilities/CancelModal';
import { MyReservationsList } from '../../../components/student/facilities/MyReservationsList';
import { ActiveReservationBanner } from '../../../components/student/facilities/ActiveReservationBanner';
import { Calendar, RefreshCw, AlertCircle } from 'lucide-react';

const LabBooking = () => {
  const [labName] = useState('Central Computing Lab');
  
  // Set default date to today (YYYY-MM-DD) in local browser perspective
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-CA');
  });

  // State managers for overlays
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch live availability
  const {
    availability,
    isLoading: loadingAvailability,
    isRefetching,
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
    liveAnnouncement,
  } = useReservation();

  // Find if user already has an active booking
  const hasActiveBooking = myBookings.some((b) => b.status === 'booked');
  const activeBooking = myBookings.find((b) => b.status === 'booked');

  // Track time elapsed since last refresh
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) setSecondsSinceUpdate(0);
    });
    const interval = setInterval(() => {
      setSecondsSinceUpdate((prev) => prev + 1);
    }, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [availability, isRefetching]);

  // Handle slot reservation confirmation
  const handleConfirmReservation = async () => {
    if (!selectedSlot) return;
    setErrorMessage('');
    
    try {
      // startTime/endTime must be in ISO format
      await createBooking({
        seatId: selectedSlot.seatId,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });
      // Close modal on success
      setSelectedSlot(null);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to complete reservation. Please try again.');
    }
  };

  // Handle booking cancellation confirmation
  const handleConfirmCancellation = () => {
    if (!cancellingBooking) return;
    cancelBooking(cancellingBooking._id, {
      onSuccess: () => {
        setCancellingBooking(null);
      },
    });
  };

  const formattedDateLabel = new Date(selectedDate).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 py-4">
      {/* Screen Reader Live Status Region */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Page Heading */}
      <div className="border-b border-slate-200 pb-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Computer Lab Booking</h1>
          <p className="text-xs text-slate-500 mt-1">
            Reserve individual workstation seats in the library's high-speed Central Computing Lab.
          </p>
        </div>
      </div>

      {/* Active reservation top summary banner */}
      <ActiveReservationBanner bookings={myBookings} />

      {/* Limit Alert Banner if they already have a booking */}
      {hasActiveBooking && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="font-bold text-xs">Reservation Constraint Limit Reached</h4>
            <p className="text-[10px] text-amber-700 mt-1 leading-normal">
              Students are restricted to a maximum of **1 active workstation booking** at a time. To reserve a different seat or timeslot, you must first cancel your current reservation for workstation{' '}
              <strong className="text-slate-800 font-extrabold">{activeBooking?.seatId?.seatNumber}</strong> below.
            </p>
          </div>
        </div>
      )}

      {/* Split views: Selection calendar + workstation grid on left, my list on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Workstation Grid Selectors */}
        <div className="lg:col-span-2 space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="w-full sm:w-auto">
              <label htmlFor="booking-date" className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1.5">
                Target Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  id="booking-date"
                  type="date"
                  value={selectedDate}
                  min={new Date().toLocaleDateString('en-CA')}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-48 pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 text-xs font-bold text-slate-700"
                />
              </div>
            </div>

            {/* Freshness Polling Status Tag */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div className="text-right text-[10px] font-bold text-slate-400">
                {isRefetching ? (
                  <span className="text-indigo animate-pulse">Syncing...</span>
                ) : (
                  <span>Updated {secondsSinceUpdate}s ago</span>
                )}
              </div>
              <button
                onClick={() => refetchAvailability()}
                disabled={loadingAvailability || isRefetching}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-indigo transition-colors focus:ring-2 focus:ring-slate-400 focus:outline-none"
                aria-label="Refresh availability now"
              >
                <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Seat selection list grid */}
          {loadingAvailability ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
              <RefreshCw className="animate-spin text-indigo-500" size={32} />
              <span>Querying workstation availability matrix...</span>
            </div>
          ) : (
            <WorkstationGrid
              availability={availability}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              hasActiveBooking={hasActiveBooking}
            />
          )}
        </div>

        {/* Right Column: Student Bookings History */}
        <div className="space-y-6">
          {loadingMyBookings ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Loading active bookings...
            </div>
          ) : (
            <MyReservationsList
              bookings={myBookings}
              onCancelRequest={setCancellingBooking}
            />
          )}

          {/* Guidelines box */}
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-700">Lab Operating Policies</h4>
            <ul className="text-[10px] text-slate-500 space-y-2 list-disc list-inside leading-relaxed font-medium">
              <li>Reservations are strictly limited to **1-hour increments** starting on the hour.</li>
              <li>Please cancel bookings at least **15 minutes in advance** if you cannot attend.</li>
              <li>Workstations automatically log out after **5 minutes** of idle activity.</li>
              <li>No food or drink permitted inside the Digital Computing spaces.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation overlays */}
      <ReservationModal
        slot={selectedSlot}
        dateLabel={formattedDateLabel}
        isPending={isCreating}
        errorMessage={errorMessage}
        onConfirm={handleConfirmReservation}
        onClose={() => {
          setSelectedSlot(null);
          setErrorMessage('');
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
