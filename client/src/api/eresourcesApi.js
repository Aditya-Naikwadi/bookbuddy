import apiClient from "./client";

export const searchEbooks = async ({ search, language, topic, page }) => {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (language) params.append("language", language);
  if (topic) params.append("topic", topic);
  if (page) params.append("page", page);

  const { data } = await apiClient.get(
    `/eresources/external?${params.toString()}`,
  );
  return data.data;
};

export const getEbookDetail = async (gutenbergId) => {
  const { data } = await apiClient.get(`/eresources/external/${gutenbergId}`);
  return data.data;
};

export const openEbook = async (gutenbergId) => {
  const { data } = await apiClient.post(
    `/eresources/external/${gutenbergId}/open`,
  );
  return data.data; // { resourceId }
};

export const getContentUrl = (resourceId, format) => {
  return `${import.meta.env.VITE_API_URL || "/api"}/eresources/external/${resourceId}/content?format=${format}`;
};

export const saveProgress = async (
  resourceId,
  { lastPosition, percentComplete },
) => {
  const { data } = await apiClient.post(`/eresources/${resourceId}/progress`, {
    lastPosition,
    percentComplete,
  });
  return data;
};
