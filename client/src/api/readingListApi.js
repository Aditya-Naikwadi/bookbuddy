import apiClient from "./client";

export const getReadingLists = async (params = {}) => {
  const { data } = await apiClient.get("/reading-lists", { params });
  return data;
};

export const getReadingListById = async (id) => {
  const { data } = await apiClient.get(`/reading-lists/${id}`);
  return data.data;
};

export const createReadingList = async (payload) => {
  const { data } = await apiClient.post("/reading-lists", payload);
  return data.data;
};

export const updateReadingList = async (id, payload) => {
  const { data } = await apiClient.patch(`/reading-lists/${id}`, payload);
  return data.data;
};

export const deleteReadingList = async (id) => {
  const { data } = await apiClient.delete(`/reading-lists/${id}`);
  return data;
};

export const getMyBookmarks = async (params = {}) => {
  const { data } = await apiClient.get("/bookmarks/me", { params });
  return data;
};

export const createBookmark = async (payload) => {
  const { data } = await apiClient.post("/bookmarks", payload);
  return data.data;
};

export const deleteBookmark = async (id) => {
  const { data } = await apiClient.delete(`/bookmarks/${id}`);
  return data;
};

const readingListApi = {
  getReadingLists,
  getReadingListById,
  createReadingList,
  updateReadingList,
  deleteReadingList,
  getMyBookmarks,
  createBookmark,
  deleteBookmark,
};

export default readingListApi;
