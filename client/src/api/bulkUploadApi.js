import apiClient from './client';

export const bulkUploadApi = {
  uploadStudentCsv: async (formData) => {
    const { data } = await apiClient.post('/admin/bulk-upload/students', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },
};

export default bulkUploadApi;
