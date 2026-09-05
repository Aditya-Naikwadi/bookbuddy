import apiClient from "./client";
import { toast } from "../store/toastStore";

/**
 * Fetch annotations for a given book
 */
export const getBookAnnotations = async (bookId, type) => {
  const params = type ? { type } : {};
  try {
    const res = await apiClient.get(`/books/${bookId}/annotations`, {
      params,
    });
    return res.data;
  } catch {
    // Fallback to legacy endpoint if nested fails
    const res = await apiClient.get(`/annotations`, {
      params: { resourceId: bookId, ...params },
    });
    return res.data;
  }
};

/**
 * Create a new annotation (highlight, bookmark, or note)
 */
export const createAnnotationApi = async (bookId, data) => {
  try {
    const res = await apiClient.post(`/books/${bookId}/annotations`, data);
    const label = data.type === "note" ? "Note Saved" : data.type === "bookmark" ? "Bookmark Saved" : "Highlight Saved";
    toast.success(label, "Your reading annotation has been saved.");
    return res.data;
  } catch (err) {
    toast.error("Failed to Save", err.response?.data?.message || "Could not save annotation.");
    throw err;
  }
};

/**
 * Update an existing annotation
 */
export const updateAnnotationApi = async (annotationId, data) => {
  try {
    const res = await apiClient.patch(`/annotations/${annotationId}`, data);
    toast.success("Updated", "Annotation updated successfully.");
    return res.data;
  } catch (err) {
    toast.error("Update Failed", err.response?.data?.message || "Could not update annotation.");
    throw err;
  }
};

/**
 * Delete an annotation
 */
export const deleteAnnotationApi = async (annotationId) => {
  try {
    const res = await apiClient.delete(`/annotations/${annotationId}`);
    toast.info("Deleted", "Annotation removed.");
    return res.data;
  } catch (err) {
    toast.error("Delete Failed", err.response?.data?.message || "Could not delete annotation.");
    throw err;
  }
};

/**
 * Sync offline annotations in bulk
 */
export const syncAnnotationsApi = async (bookId, items) => {
  const res = await apiClient.post(`/books/${bookId}/annotations/sync`, {
    items,
  });
  return res.data;
};

/**
 * Export annotations as a JSON document
 */
export const exportAnnotationsApi = async (bookId) => {
  const res = await apiClient.get(`/books/${bookId}/annotations/export`);
  return res.data;
};

/**
 * Full-text search annotations
 */
export const searchAnnotationsApi = async (query) => {
  const res = await apiClient.get(`/annotations/search`, {
    params: { q: query },
  });
  return res.data;
};
