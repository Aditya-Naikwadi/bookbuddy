import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import { streakApi } from "../api/streakApi";

const fetchStudentOverview = async () => {
  const { data } = await apiClient.get("/dashboards/student/overview");
  return data.data;
};

export const useStudentOverview = () => {
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["student-overview"],
    queryFn: fetchStudentOverview,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Renewal Mutation with Optimistic UI update
  const renewMutation = useMutation({
    mutationFn: async (loanId) => {
      const { data } = await apiClient.post(
        `/dashboards/student/loans/${loanId}/renew`,
      );
      return data;
    },
    onMutate: async (loanId) => {
      await queryClient.cancelQueries({ queryKey: ["student-overview"] });
      const previousData = queryClient.getQueryData(["student-overview"]);

      if (previousData?.activeLoans) {
        const updatedLoans = previousData.activeLoans.map((loan) => {
          if (loan._id === loanId) {
            const currentDue = new Date(loan.dueDate);
            currentDue.setDate(currentDue.getDate() + 14);
            return {
              ...loan,
              dueDate: currentDue.toISOString(),
              renewalCount: (loan.renewalCount || 0) + 1,
            };
          }
          return loan;
        });
        queryClient.setQueryData(["student-overview"], {
          ...previousData,
          activeLoans: updatedLoans,
        });
      }
      return { previousData };
    },
    onError: (err, loanId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["student-overview"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["student-overview"] });
      queryClient.invalidateQueries({ queryKey: ["my-loans"] });
    },
  });

  // Daily Streak Check-in Mutation with Optimistic UI update
  const checkInMutation = useMutation({
    mutationFn: streakApi.checkIn,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["student-overview"] });
      const previousData = queryClient.getQueryData(["student-overview"]);

      if (previousData?.streak) {
        queryClient.setQueryData(["student-overview"], {
          ...previousData,
          streak: {
            ...previousData.streak,
            currentStreak: (previousData.streak.currentStreak || 0) + 1,
            todayComplete: true,
          },
        });
      }
      return { previousData };
    },
    onError: (err, vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["student-overview"], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["student-overview"] });
      queryClient.invalidateQueries({ queryKey: ["streak", "me"] });
    },
  });

  // Cancel Hold Mutation
  const cancelHoldMutation = useMutation({
    mutationFn: async (reservationId) => {
      const { data } = await apiClient.delete(`/reservations/${reservationId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-overview"] });
      queryClient.invalidateQueries({ queryKey: ["my-queue"] });
    },
  });

  return {
    overview: overviewQuery.data || null,
    isLoading: overviewQuery.isLoading,
    isError: overviewQuery.isError,
    refetch: overviewQuery.refetch,
    renewLoan: renewMutation.mutateAsync,
    isRenewing: renewMutation.isPending,
    renewingLoanId: renewMutation.variables,
    checkIn: checkInMutation.mutateAsync,
    isCheckInPending: checkInMutation.isPending,
    cancelHold: cancelHoldMutation.mutateAsync,
    isCancellingHold: cancelHoldMutation.isPending,
    cancellingHoldId: cancelHoldMutation.variables,
  };
};

export default useStudentOverview;
