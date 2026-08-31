import axios from "axios";

const getAuthHeader = () => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Fetch annotations for a given book
 */
export const getBookAnnotations = async (bookId, type) => {
  const params = type ? { type } : {};
  try {
    const res = await axios.get(`/api/v1/books/${bookId}/annotations`, {
      headers: getAuthHeader(),
      params,
    });
    return res.data;
  } catch {
    // Fallback to legacy endpoint if nested fails
    const res = await axios.get(`/api/v1/annotations`, {
      headers: getAuthHeader(),
      params: { resourceId: bookId, ...params },
    });
    return res.data;
  }
};

/**
 * Create a new annotation (highlight, bookmark, or note)
 */
export const createAnnotationApi = async (bookId, data) => {
  const res = await axios.post(`/api/v1/books/${bookId}/annotations`, data, {
    headers: getAuthHeader(),
  });
  return res.data;
};

/**
 * Update an existing annotation
 */
export const updateAnnotationApi = async (annotationId, data) => {
  const res = await axios.patch(`/api/v1/annotations/${annotationId}`, data, {
    headers: getAuthHeader(),
  });
  return res.data;
};

/**
 * Delete an annotation
 */
export const deleteAnnotationApi = async (annotationId) => {
  const res = await axios.delete(`/api/v1/annotations/${annotationId}`, {
    headers: getAuthHeader(),
  });
  return res.data;
};

/**
 * Sync offline annotations in bulk
 */
export const syncAnnotationsApi = async (bookId, items) => {
  const res = await axios.post(
    `/api/v1/books/${bookId}/annotations/sync`,
    { items },
    { headers: getAuthHeader() },
  );
  return res.data;
};

/**
 * Export annotations as a JSON document
 */
export const exportAnnotationsApi = async (bookId) => {
  const res = await axios.get(`/api/v1/books/${bookId}/annotations/export`, {
    headers: getAuthHeader(),
  });
  return res.data;
};

/**
 * Full-text search annotations
 */
export const searchAnnotationsApi = async (query) => {
  const res = await axios.get(`/api/v1/annotations/search`, {
    headers: getAuthHeader(),
    params: { q: query },
  });
  return res.data;
};
