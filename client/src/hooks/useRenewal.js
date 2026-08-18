import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export function useRenewal() {
  const queryClient = useQueryClient();

  const renewMutation = useMutation({
    mutationFn: async (loanId) => {
      const res = await axios.post(`/api/v1/loans/${loanId}/renew`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["myLoans"] });
    },
  });

  return {
    renewLoan: renewMutation.mutateAsync,
    isRenewing: renewMutation.isPending,
  };
}
