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
  return `${import.meta.env.VITE_API_URL || "/api/v1"}/eresources/external/${resourceId}/content?format=${format}`;
};

export const getAllResources = async () => {
  try {
    const { data } = await apiClient.get("/eresources");
    return data.data || data;
  } catch {
    return [];
  }
};

export const updateResource = async (resourceId, payload) => {
  const { data } = await apiClient.put(`/eresources/${resourceId}`, payload);
  return data.data || data;
};

const eresourcesApi = {
  searchEbooks,
  getEbookDetail,
  openEbook,
  getContentUrl,
  saveProgress,
  getAllResources,
  updateResource,
};

export default eresourcesApi;
