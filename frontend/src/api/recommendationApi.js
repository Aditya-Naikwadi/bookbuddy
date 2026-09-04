import apiClient from "./client";

export const getMyRecommendations = async (params = {}) => {
  const { data } = await apiClient.get("/recommendations/me", { params });
  return data;
};

const recommendationApi = {
  getMyRecommendations,
};

export default recommendationApi;
