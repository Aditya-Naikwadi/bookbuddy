import apiClient from './client';

export const getBookReviews = async (bookId, { pageParam = 1, limit = 10 } = {}) => {
  const { data } = await apiClient.get(`/books/${bookId}/reviews`, {
    params: { page: pageParam, limit },
  });
  return data;
};

export const submitBookReview = async (bookId, reviewData) => {
  const { data } = await apiClient.post(`/books/${bookId}/reviews`, reviewData);
  return data;
};
