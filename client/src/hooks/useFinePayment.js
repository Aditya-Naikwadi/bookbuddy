import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export function useFinePayment() {
  const queryClient = useQueryClient();

  const createOrderMutation = useMutation({
    mutationFn: async ({ fineId, amount }) => {
      const res = await axios.post("/api/v1/payments/create-order", {
        fineId,
        amount: Math.round(amount * 100), // convert rupees to paise
      });
      return res.data;
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await axios.post("/api/v1/payments/verify-payment", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      queryClient.invalidateQueries({ queryKey: ["myFines"] });
      queryClient.invalidateQueries({ queryKey: ["studentDashboard"] });
    },
  });

  return {
    createOrder: createOrderMutation.mutateAsync,
    verifyPayment: verifyPaymentMutation.mutateAsync,
    isProcessing:
      createOrderMutation.isPending || verifyPaymentMutation.isPending,
  };
}
