import apiClient from './client';

export const academicSupportApi = {
  submitBookSuggestion: async (title, author, reason) => {
    const { data } = await apiClient.post('/book-suggestions', {
      title,
      author,
      reason,
    });
    return data.data;
  },
  getBookSuggestions: async () => {
    const { data } = await apiClient.get('/book-suggestions');
    return data.data;
  },
  submitComplaint: async (subject, description) => {
    const { data } = await apiClient.post('/complaints', {
      subject,
      description,
    });
    return data.data;
  },
  getMyComplaints: async () => {
    const { data } = await apiClient.get('/complaints');
    return data.data;
  },
  submitFeedback: async (category, message, rating) => {
    const { data } = await apiClient.post('/feedback', {
      category,
      message,
      rating,
    });
    return data.data;
  },
  getFeedback: async () => {
    const { data } = await apiClient.get('/feedback');
    return data.data;
  },
};

export default academicSupportApi;
