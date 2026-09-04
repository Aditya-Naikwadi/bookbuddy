import apiClient from "./client";

export const getAcquisitionOrders = async (params = {}) => {
  const { data } = await apiClient.get("/acquisitions", { params });
  return data;
};

export const getAcquisitionStats = async () => {
  const { data } = await apiClient.get("/acquisitions/stats");
  return data;
};

export const getAcquisitionById = async (id) => {
  const { data } = await apiClient.get(`/acquisitions/${id}`);
  return data;
};

export const createAcquisitionOrder = async (payload) => {
  const { data } = await apiClient.post("/acquisitions", payload);
  return data;
};

export const updateAcquisitionStatus = async (id, payload) => {
  const { data } = await apiClient.patch(`/acquisitions/${id}/status`, payload);
  return data;
};

export const deleteAcquisitionOrder = async (id) => {
  const { data } = await apiClient.delete(`/acquisitions/${id}`);
  return data;
};

const acquisitionApi = {
  getAcquisitionOrders,
  getAcquisitionStats,
  getAcquisitionById,
  createAcquisitionOrder,
  updateAcquisitionStatus,
  deleteAcquisitionOrder,
};

export default acquisitionApi;
