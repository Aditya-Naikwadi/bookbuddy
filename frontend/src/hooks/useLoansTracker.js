import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";

// Unified fetch function collapsing 5 queries into 1 fast projected summary
const fetchSummary = async () => {
  try {
    const { data } = await apiClient.get(
      "/dashboards/student/loans-tracker-summary",
    );
    return (
      data.data || {
        loans: { active: [], history: [] },
        queue: [],
        fines: [],
        finesSummary: { totalUnpaid: 0, unpaidCount: 0 },
        profile: null,
      }
    );
  } catch {
    return {
      loans: { active: [], history: [] },
      queue: [],
      fines: [],
      finesSummary: { totalUnpaid: 0, unpaidCount: 0 },
      profile: null,
    };
  }
};

// Main hook wrapper
export const useLoansTracker = () => {
  const queryClient = useQueryClient();

  // 1. Single collapsed summary query
  const summaryQuery = useQuery({
    queryKey: ["loans-tracker-summary"],
    queryFn: fetchSummary,
    staleTime: 60000,
  });

  const loans = summaryQuery.data?.loans || { active: [], history: [] };
  const queue = summaryQuery.data?.queue || [];
  const fines = summaryQuery.data?.fines || [];
  const finesSummary = summaryQuery.data?.finesSummary || {
    totalUnpaid: 0,
    unpaidCount: 0,
  };
  const profile = summaryQuery.data?.profile || null;
  const isLoading = summaryQuery.isLoading;
  const isError = summaryQuery.isError;

  // 2. Mutations

  // Renewal mutation with Optimistic UI updates
  const renewMutation = useMutation({
    mutationFn: async (loanId) => {
      const { data } = await apiClient.post(
        `/dashboards/student/loans/${loanId}/renew`,
      );
      return data;
    },
    onMutate: async (loanId) => {
      await queryClient.cancelQueries({ queryKey: ["loans-tracker-summary"] });
      const previousSummary = queryClient.getQueryData([
        "loans-tracker-summary",
      ]);

      queryClient.setQueryData(["loans-tracker-summary"], (old) => {
        if (!old || !old.loans) return old;
        const updatedActive = (old.loans.active || []).map((loan) => {
          if ((loan._id || loan.id) === loanId) {
            const currentDue = new Date(loan.dueDate);
            currentDue.setDate(currentDue.getDate() + 14);
            return {
              ...loan,
              dueDate: currentDue.toISOString(),
              renewalCount: (loan.renewalCount || 0) + 1,
              remainingRenewals: Math.max(
                0,
                (loan.remainingRenewals ?? loan.maxRenewals) - 1,
              ),
            };
          }
          return loan;
        });

        return {
          ...old,
          loans: { ...old.loans, active: updatedActive },
        };
      });

      return { previousSummary };
    },
    onError: (err, loanId, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(
          ["loans-tracker-summary"],
          context.previousSummary,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["loans-tracker-summary"] });
    },
  });

  // Fine payment mutation (server confirmation, no optimistic UI for payments per acceptance criteria)
  const payFineMutation = useMutation({
    mutationFn: async ({ fineId, useWaiver = false }) => {
      const { data } = await apiClient.post(
        `/dashboards/student/fines/${fineId}/pay`,
        { useWaiver },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans-tracker-summary"] });
    },
  });

  // Cancel hold reservation mutation
  const cancelHoldMutation = useMutation({
    mutationFn: async (reservationId) => {
      const { data } = await apiClient.delete(
        `/dashboards/student/reservations/${reservationId}`,
      );
      return data;
    },
    onMutate: async (reservationId) => {
      await queryClient.cancelQueries({ queryKey: ["loans-tracker-summary"] });
      const previousSummary = queryClient.getQueryData([
        "loans-tracker-summary",
      ]);

      queryClient.setQueryData(["loans-tracker-summary"], (old) => {
        if (!old) return old;
        return {
          ...old,
          queue: (old.queue || []).filter(
            (q) => (q._id || q.id) !== reservationId,
          ),
        };
      });

      return { previousSummary };
    },
    onError: (err, reservationId, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(
          ["loans-tracker-summary"],
          context.previousSummary,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["loans-tracker-summary"] });
    },
  });

  return {
    loans,
    queue,
    fines,
    finesSummary,
    profile,
    isLoading,
    isError,
    renewLoan: renewMutation.mutateAsync,
    payFine: payFineMutation.mutateAsync,
    cancelHold: cancelHoldMutation.mutateAsync,
    isRenewing: renewMutation.isPending,
    renewingLoanId: renewMutation.variables,
    isPaying: payFineMutation.isPending,
    isCancellingHold: cancelHoldMutation.isPending,
    cancellingHoldId: cancelHoldMutation.variables,
  };
};

export default useLoansTracker;
