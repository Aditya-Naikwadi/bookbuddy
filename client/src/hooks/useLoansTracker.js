import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

// Fetch functions with robust fallback error handling
const fetchLoans = async () => {
  try {
    const { data } = await apiClient.get('/dashboards/student/loans');
    return data.data || { active: [], history: [] };
  } catch {
    return { active: [], history: [] };
  }
};

const fetchQueue = async () => {
  try {
    const { data } = await apiClient.get('/reservations/me');
    return data.data || [];
  } catch {
    return [];
  }
};

const fetchFines = async () => {
  try {
    const { data } = await apiClient.get('/fines/me');
    return data.data || [];
  } catch {
    return [];
  }
};

const fetchFinesSummary = async () => {
  try {
    const { data } = await apiClient.get('/fines/me/summary');
    return data.data || { totalUnpaid: 0, unpaidCount: 0 };
  } catch {
    return { totalUnpaid: 0, unpaidCount: 0 };
  }
};

const fetchProfile = async () => {
  try {
    const { data } = await apiClient.get('/auth/profile');
    return data.data || null;
  } catch {
    return null;
  }
};

// Main hook wrapper
export const useLoansTracker = () => {
  const queryClient = useQueryClient();

  // 1. Queries
  const loansQuery = useQuery({
    queryKey: ['my-loans'],
    queryFn: fetchLoans,
  });

  const queueQuery = useQuery({
    queryKey: ['my-queue'],
    queryFn: fetchQueue,
  });

  const finesQuery = useQuery({
    queryKey: ['my-fines'],
    queryFn: fetchFines,
  });

  const finesSummaryQuery = useQuery({
    queryKey: ['my-fines-summary'],
    queryFn: fetchFinesSummary,
  });

  const profileQuery = useQuery({
    queryKey: ['user-profile'],
    queryFn: fetchProfile,
  });

  // 2. Mutations

  // Renewal mutation with Optimistic UI updates
  const renewMutation = useMutation({
    mutationFn: async (loanId) => {
      const { data } = await apiClient.post(`/dashboards/student/loans/${loanId}/renew`);
      return data;
    },
    onMutate: async (loanId) => {
      await queryClient.cancelQueries({ queryKey: ['my-loans'] });

      const previousLoans = queryClient.getQueryData(['my-loans']);

      // Optimistically modify the target loan in cache
      queryClient.setQueryData(['my-loans'], (old) => {
        if (!old) return old;
        const updatedActive = old.active.map((loan) => {
          if (loan._id === loanId) {
            const currentDue = new Date(loan.dueDate);
            currentDue.setDate(currentDue.getDate() + 14); // Optimistically add 14 days
            return {
              ...loan,
              dueDate: currentDue.toISOString(),
              renewalCount: loan.renewalCount + 1,
            };
          }
          return loan;
        });
        return { ...old, active: updatedActive };
      });

      return { previousLoans };
    },
    onError: (err, loanId, context) => {
      if (context?.previousLoans) {
        queryClient.setQueryData(['my-loans'], context.previousLoans);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-loans'] });
    },
  });

  // Pay Fine mutation
  const payFineMutation = useMutation({
    mutationFn: async ({ fineId, useWaiver = false }) => {
      const { data } = await apiClient.post(`/fines/${fineId}/pay`, { useWaiver });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-fines'] });
      queryClient.invalidateQueries({ queryKey: ['my-fines-summary'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
  });

  // Cancel hold mutation
  const cancelHoldMutation = useMutation({
    mutationFn: async (reservationId) => {
      const { data } = await apiClient.delete(`/reservations/${reservationId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-queue'] });
      // Invalidate loans query as well, in case renewal availability shifts
      queryClient.invalidateQueries({ queryKey: ['my-loans'] });
    },
  });

  return {
    // Queries data & statuses
    loans: loansQuery.data || { active: [], history: [] },
    queue: queueQuery.data || [],
    fines: finesQuery.data || [],
    finesSummary: finesSummaryQuery.data || { totalUnpaid: 0, unpaidCount: 0 },
    profile: profileQuery.data || null,
    
    isLoading:
      loansQuery.isLoading ||
      queueQuery.isLoading ||
      finesQuery.isLoading ||
      finesSummaryQuery.isLoading ||
      profileQuery.isLoading,
    
    isError:
      loansQuery.isError ||
      queueQuery.isError ||
      finesQuery.isError ||
      finesSummaryQuery.isError ||
      profileQuery.isError,

    // Mutation triggers
    renewLoan: renewMutation.mutateAsync,
    isRenewing: renewMutation.isPending,
    renewingLoanId: renewMutation.variables,

    payFine: payFineMutation.mutateAsync,
    isPaying: payFineMutation.isPending,

    cancelHold: cancelHoldMutation.mutateAsync,
    isCancellingHold: cancelHoldMutation.isPending,
    cancellingHoldId: cancelHoldMutation.variables,
  };
};
