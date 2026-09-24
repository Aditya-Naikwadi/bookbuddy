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

  const refetch = async () => {
    return query.refetch({ queryKey: ["admin-overview"] });
  };

  return {
    overview: query.data || null,
    isLoading: query.isLoading || query.isFetching,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () =>
      adminApi.getOverview(true).then((data) => {
        query.refetch();
        return data;
      }),
  };
};

export default useAdminOverview;
