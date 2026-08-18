import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API_BASE = "/api/v1/book-requests";

export function useBookRequest() {
  const queryClient = useQueryClient();

  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["bookRequests"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/me`);
      return res.data.data;
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (newReq) => {
      const res = await axios.post(API_BASE, newReq);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookRequests"] });
    },
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return {
    requests,
    pendingCount,
    isLoading,
    error,
    createRequest: createRequestMutation.mutateAsync,
    isSubmitting: createRequestMutation.isPending,
  };
}
