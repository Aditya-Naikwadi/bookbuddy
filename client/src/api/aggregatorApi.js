import apiClient from "./client";

/**
 * Fetch aggregated external books (UnifiedBook collection)
 */
export const getAggregatedBooksApi = async (params = {}) => {
  const { data } = await apiClient.get("/aggregator", { params });
  return data;
};
