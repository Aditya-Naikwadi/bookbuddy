import apiClient from "./client";

export const adminApi = {
  getOverview: async () => {
    const { data } = await apiClient.get("/dashboards/admin-portal/overview");
    return data.data;
  },
  listColleges: async () => {
    const { data } = await apiClient.get("/dashboards/admin-portal/colleges");
    return data.data;
  },
  getCollegeDetails: async (id) => {
    const { data } = await apiClient.get(
      `/dashboards/admin-portal/colleges/${id}`,
    );
    return data.data;
  },
  createCollege: async (collegeData) => {
    const { data } = await apiClient.post(
      "/dashboards/admin-portal/colleges",
      collegeData,
    );
    return data;
  },
  updateCollege: async (id, collegeData) => {
    const { data } = await apiClient.put(
      `/dashboards/admin-portal/colleges/${id}`,
      collegeData,
    );
    return data;
  },
  updateCollegeStatus: async (id, status) => {
    const { data } = await apiClient.patch(
      `/dashboards/admin-portal/colleges/${id}/status`,
      { status },
    );
    return data;
  },
  getAdmins: async (collegeId) => {
    const { data } = await apiClient.get("/dashboards/admin-portal/admins", {
      params: { collegeId },
    });
    return data.data;
  },
  createAdmin: async (adminData) => {
    const { data } = await apiClient.post(
      "/dashboards/admin-portal/admins",
      adminData,
    );
    return data;
  },
  getAuditLogs: async (params) => {
    const { data } = await apiClient.get(
      "/dashboards/admin-portal/audit-logs",
      { params },
    );
    return data;
  },
  getPendingModeration: async (page = 1, limit = 100, status = "pending") => {
    const { data } = await apiClient.get(
      "/dashboards/admin-portal/moderation/pending",
      {
        params: { page, limit, status },
      },
    );
    return data;
  },
  moderateResource: async (id, status, note) => {
    const { data } = await apiClient.put(
      `/dashboards/admin-portal/moderation/${id}`,
      { status, note },
    );
    return data;
  },
  moderateEResource: async (id, payload) => {
    const { data } = await apiClient.put(
      `/dashboards/admin-portal/moderation/${id}`,
      payload,
    );
    return data;
  },
  publishResource: async (id) => {
    const { data } = await apiClient.post(
      `/dashboards/admin-portal/moderation/${id}/publish`,
    );
    return data;
  },
};

export default adminApi;
