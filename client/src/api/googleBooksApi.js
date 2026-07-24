import apiClient from './client';

export const searchGoogleBooks = async ({ search = 'computer science', category, page = 1, limit = 12 }) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (category) params.append('category', category);
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);

  const { data } = await apiClient.get(`/google-books/search?${params.toString()}`);
  return data.data;
};

export const getGoogleBookDetail = async (volumeId) => {
  const { data } = await apiClient.get(`/google-books/volume/${volumeId}`);
  return data.data;
};

export const importGoogleBook = async (volumeId) => {
  const { data } = await apiClient.post('/google-books/import', { volumeId });
  return data;
};

export const seedGoogleBooks = async (topics) => {
  const { data } = await apiClient.post('/google-books/seed', { topics });
  return data;
};
