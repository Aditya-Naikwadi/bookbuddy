import apiClient from './client';

export const registrationApi = {
  // Public active colleges list for Flow A
  getActiveColleges: async () => {
    const { data } = await apiClient.get('/registration/colleges');
    return data.data;
  },

  // Flow A: Student registration
  registerStudent: async (studentData) => {
    const { data } = await apiClient.post('/registration/student', studentData);
    return data;
  },

  // Flow A: Verify OTP
  verifyStudentEmail: async (verificationData) => {
    const { data } = await apiClient.post('/registration/verify-email', verificationData);
    return data;
  },

  // Flow B: Tenant onboarding (supports FormData for document upload)
  submitTenantOnboarding: async (formData) => {
    const { data } = await apiClient.post('/registration/tenant-onboarding', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  // Super Admin: Get pending onboarding requests
  getPendingOnboardings: async (page = 1, limit = 20) => {
    const { data } = await apiClient.get('/dashboards/admin-portal/onboardings/pending', {
      params: { page, limit },
    });
    return data;
  },

  // Super Admin: Approve onboarding request
  approveOnboarding: async (requestId) => {
    const { data } = await apiClient.post(`/dashboards/admin-portal/onboardings/${requestId}/approve`);
    return data;
  },

  // Super Admin: Reject onboarding request
  rejectOnboarding: async (requestId, reason) => {
    const { data } = await apiClient.post(`/dashboards/admin-portal/onboardings/${requestId}/reject`, {
      reason,
    });
    return data;
  },
};

export default registrationApi;
