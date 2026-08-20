import apiClient from "./client";

export const getWatchStatus = async (bookId) => {
  const { data } = await apiClient.get(`/books/${bookId}/watch`);
  return data;
};

export const watchBook = async (bookId) => {
  const { data } = await apiClient.post(`/books/${bookId}/watch`);
  return data;
};

export const unwatchBook = async (bookId) => {
  const { data } = await apiClient.delete(`/books/${bookId}/watch`);
  return data;
};
