import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API_BASE = "/api/v1/shelves";

export function useShelf() {
  const queryClient = useQueryClient();

  const {
    data: shelves = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shelves"],
    queryFn: async () => {
      const res = await axios.get(API_BASE);
      return res.data.data;
    },
  });

  const createShelfMutation = useMutation({
    mutationFn: async (newShelf) => {
      const res = await axios.post(API_BASE, newShelf);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shelves"] });
    },
  });

  const updateShelfMutation = useMutation({
    mutationFn: async ({ id, ...updatedData }) => {
      const res = await axios.patch(`${API_BASE}/${id}`, updatedData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shelves"] });
    },
  });

  const deleteShelfMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axios.delete(`${API_BASE}/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shelves"] });
    },
  });

  const addBookMutation = useMutation({
    mutationFn: async ({ shelfId, bookId }) => {
      const res = await axios.post(`${API_BASE}/${shelfId}/books`, { bookId });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shelves"] });
    },
  });

  const removeBookMutation = useMutation({
    mutationFn: async ({ shelfId, bookId }) => {
      const res = await axios.delete(`${API_BASE}/${shelfId}/books/${bookId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shelves"] });
    },
  });

  return {
    shelves,
    isLoading,
    error,
    createShelf: createShelfMutation.mutateAsync,
    updateShelf: updateShelfMutation.mutateAsync,
    deleteShelf: deleteShelfMutation.mutateAsync,
    addBookToShelf: addBookMutation.mutateAsync,
    removeBookFromShelf: removeBookMutation.mutateAsync,
    isCreating: createShelfMutation.isPending,
  };
}
