import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi } from '../api/facilitiesApi';
import { useState } from 'react';

export const useReservation = () => {
  const queryClient = useQueryClient();
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // 1. Fetch Student's Bookings
  const {
    data: myBookings = [],
    isLoading: loadingMyBookings,
    error: errorMyBookings,
  } = useQuery({
    queryKey: ['my-lab-bookings'],
    queryFn: facilitiesApi.getMyBookings,
  });

  // 2. Create Booking Mutation (Collision Safety + Race Conditions)
  const createBookingMutation = useMutation({
    mutationFn: ({ seatId, startTime, endTime }) =>
      facilitiesApi.createBooking(seatId, startTime, endTime),
    onSuccess: () => {
      // Invalidate availability and booking lists
      queryClient.invalidateQueries({ queryKey: ['lab-availability'] });
      queryClient.invalidateQueries({ queryKey: ['my-lab-bookings'] });
      // Invalidate streak query since booking counts as a qualifying action!
      queryClient.invalidateQueries({ queryKey: ['streak', 'me'] });

      setLiveAnnouncement(`Reservation successful! Your workstation booking has been confirmed.`);
    },
    onError: (error) => {
      const isConflict = error.response?.status === 409 || error.message?.includes('409');
      const message = isConflict
        ? 'Double-booking conflict: This workstation slot was just reserved by another student. Please select a different timeslot.'
        : error.response?.data?.message || 'Failed to complete reservation. Please try again.';

      setLiveAnnouncement(`Reservation failed. ${message}`);
      // Re-throw with custom message for component UI consumption
      throw new Error(message);
    },
  });

  // 3. Cancel Booking Mutation (Optimistic UI Updates)
  const cancelBookingMutation = useMutation({
    mutationFn: facilitiesApi.cancelBooking,
    onMutate: async (bookingId) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['my-lab-bookings'] });

      // Snapshot previous value
      const prevBookings = queryClient.getQueryData(['my-lab-bookings']);

      // Optimistically remove the booking from cache
      if (prevBookings) {
        queryClient.setQueryData(
          ['my-lab-bookings'],
          prevBookings.filter((b) => b._id !== bookingId)
        );
      }

      return { prevBookings };
    },
    onSuccess: () => {
      setLiveAnnouncement('Workstation booking cancelled successfully.');
    },
    onError: (err, bookingId, context) => {
      // Rollback on error
      if (context?.prevBookings) {
        queryClient.setQueryData(['my-lab-bookings'], context.prevBookings);
      }
      setLiveAnnouncement('Cancellation failed. Please verify your connection.');
    },
    onSettled: () => {
      // Always refetch to reconcile with server state
      queryClient.invalidateQueries({ queryKey: ['lab-availability'] });
      queryClient.invalidateQueries({ queryKey: ['my-lab-bookings'] });
    },
  });

  return {
    myBookings,
    loadingMyBookings,
    errorMyBookings,
    createBooking: createBookingMutation.mutateAsync, // Use mutateAsync to await result in UI
    isCreating: createBookingMutation.isPending,
    cancelBooking: cancelBookingMutation.mutate,
    isCancelling: cancelBookingMutation.isPending,
    liveAnnouncement,
  };
};

export default useReservation;
