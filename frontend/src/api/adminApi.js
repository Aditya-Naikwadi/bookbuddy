import apiClient from "./client";
import { moderateEResourceBodySchema } from "@shared/schemas/moderation";
import {
  createCollegeBodySchema,
  createAdminBodySchema,
} from "@shared/schemas/admin";

let listCollegesPromise = null;
let listCollegesCached = null;
let listCollegesCachedAt = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

export const invalidateCollegesCache = () => {
  listCollegesCached = null;
  listCollegesCachedAt = 0;
  listCollegesPromise = null;
};

export const adminApi = {
  getOverview: async (refresh = false) => {
    const { data } = await apiClient.get("/dashboards/admin-portal/overview", {
      params: refresh ? { refresh: "true" } : {},
    });
    return data.data;
  },
  listColleges: async (forceRefresh = false) => {
    if (
      !forceRefresh &&
      listCollegesCached &&
      Date.now() - listCollegesCachedAt < CACHE_TTL_MS
    ) {
      return listCollegesCached;
    }
    if (listCollegesPromise) {
      return listCollegesPromise;
    }
    listCollegesPromise = (async () => {
      try {
        const { data } = await apiClient.get(
          "/dashboards/admin-portal/colleges",
        );
        listCollegesCached = data.data;
        listCollegesCachedAt = Date.now();
        return data.data;
      } finally {
        listCollegesPromise = null;
      }
    })();
    return listCollegesPromise;
  },
  getCollegeDetails: async (id) => {
    const { data } = await apiClient.get(
      `/dashboards/admin-portal/colleges/${id}`,
    );
    return data.data;
  },
  createCollege: async (collegeData) => {
    const validated = createCollegeBodySchema.parse(collegeData);
    const { data } = await apiClient.post(
      "/dashboards/admin-portal/colleges",
      validated,
    );
    invalidateCollegesCache();
    return data;
  },
  updateCollege: async (id, collegeData) => {
    const { data } = await apiClient.put(
      `/dashboards/admin-portal/colleges/${id}`,
      collegeData,
    );
    invalidateCollegesCache();
    return data;
  },
  updateCollegeStatus: async (id, status) => {
    const { data } = await apiClient.patch(
      `/dashboards/admin-portal/colleges/${id}/status`,
      { status },
    );
    invalidateCollegesCache();
    return data;
  },
  getAdmins: async (collegeId) => {
    const { data } = await apiClient.get("/dashboards/admin-portal/admins", {
      params: { collegeId },
    });
    return data.data;
  },
  createAdmin: async (adminData) => {
    const validated = createAdminBodySchema.parse(adminData);
    const { data } = await apiClient.post(
      "/dashboards/admin-portal/admins",
      validated,
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
    const validated = moderateEResourceBodySchema.parse({ status, note });
    const { data } = await apiClient.put(
      `/dashboards/admin-portal/moderation/${id}`,
      validated,
    );
    return data;
  },
  moderateEResource: async (id, payload) => {
    const validated = moderateEResourceBodySchema.parse(payload);
    const { data } = await apiClient.put(
      `/dashboards/admin-portal/moderation/${id}`,
      validated,
    );
    return data;
  },
  publishResource: async (id) => {
    const { data } = await apiClient.post(
      `/dashboards/admin-portal/moderation/${id}/publish`,
    );
    return data;
  },

  // User Management APIs
  getUsers: async (params) => {
    const { data } = await apiClient.get("/dashboards/admin-portal/users", {
      params,
    });
    return data;
  },
  updateUserStatus: async (id, payload) => {
    const { data } = await apiClient.patch(
      `/dashboards/admin-portal/users/${id}/status`,
      payload,
    );
    return data;
  },
  updateUserRole: async (id, role) => {
    const { data } = await apiClient.patch(
      `/dashboards/admin-portal/users/${id}/role`,
      { role },
    );
    return data;
  },
  resetUserPassword: async (id, newPassword) => {
    const { data } = await apiClient.post(
      `/dashboards/admin-portal/users/${id}/reset-password`,
      { newPassword },
    );
    return data;
  },
  impersonateUser: async (id, totpCode) => {
    const { data } = await apiClient.post(
      `/dashboards/admin-portal/users/${id}/impersonate`,
      { totpCode },
    );
    return data;
  },
  revokeImpersonationToken: async (token) => {
    const { data } = await apiClient.post(
      "/dashboards/admin-portal/users/revoke-impersonation",
      { token },
    );
    return data;
  },

  // Infrastructure Telemetry & Cron Logs APIs
  getSystemHealth: async () => {
    const { data } = await apiClient.get(
      "/dashboards/admin-portal/system/health",
    );
    return data.data;
  },
  getCronLogs: async (params) => {
    const { data } = await apiClient.get(
      "/dashboards/admin-portal/system/cron-logs",
      {
        params,
      },
    );
    return data;
  },

  // Data Oversight APIs
  getGlobalLoans: async (params) => {
    const { data } = await apiClient.get(
      "/dashboards/admin-portal/data/loans",
      {
        params,
      },
    );
    return data;
  },
  getGlobalFines: async (params) => {
    const { data } = await apiClient.get(
      "/dashboards/admin-portal/data/fines",
      {
        params,
      },
    );
    return data;
  },
  getGlobalCatalog: async (params) => {
    const { data } = await apiClient.get(
      "/dashboards/admin-portal/data/catalog",
      {
        params,
      },
    );
    return data;
  },

  // Global Support & Complaints APIs
  getGlobalComplaints: async (params) => {
    const { data } = await apiClient.get(
      "/dashboards/admin-portal/support/complaints",
      {
        params,
      },
    );
    return data;
  },
  updateComplaintStatus: async (id, payload) => {
    const { data } = await apiClient.patch(
      `/dashboards/admin-portal/support/complaints/${id}`,
      payload,
    );
    return data;
  },

  // System Settings & Backup APIs
  getSystemSettings: async () => {
    const { data } = await apiClient.get("/dashboards/admin-portal/settings");
    return data.data;
  },
  updateSystemSettings: async (settingsData) => {
    const { data } = await apiClient.put(
      "/dashboards/admin-portal/settings",
      settingsData,
    );
    return data;
  },
  triggerManualBackup: async () => {
    const { data } = await apiClient.post(
      "/dashboards/admin-portal/settings/trigger-backup",
    );
    return data;
  },
};

export default adminApi;
