import { useQuery } from "@tanstack/react-query";
import adminApi from "../api/adminApi";

export const useAdminOverview = () => {
  const query = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const data = await adminApi.getOverview();
      return data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  return {
    overview: query.data || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

export default useAdminOverview;
