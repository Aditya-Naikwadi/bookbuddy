import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/client";
import useAuthStore from "../store/authStore";
import useSocket from "./useSocket";

/**
 * Gets effective collegeId (from parameter or auth user or selected fallback)
 */
const getEffectiveCollegeId = (collegeIdParam) => {
  if (collegeIdParam) return collegeIdParam;
  const user = useAuthStore.getState().user;
  return user?.collegeId || "default";
};

/**
 * Global Socket Listener hook to invalidate React Query book cache entries on real-time changes
 */
export const useBookRealtimeSync = (collegeIdParam) => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const collegeId = getEffectiveCollegeId(collegeIdParam);

  useEffect(() => {
    if (!socket || !collegeId) return;

    const handleBookChange = (_payload) => {
      // Invalidate all book queries for this college
      queryClient.invalidateQueries({ queryKey: ["books", collegeId] });
      queryClient.invalidateQueries({ queryKey: ["bookStats", collegeId] });
      queryClient.invalidateQueries({ queryKey: ["newArrivals", collegeId] });
    };

    socket.on("book:availability_changed", handleBookChange);
    socket.on("book:added", handleBookChange);

    return () => {
      socket.off("book:availability_changed", handleBookChange);
      socket.off("book:added", handleBookChange);
    };
  }, [socket, collegeId, queryClient]);
};

/**
 * Single aggregated General Dashboard hook (1 network round-trip)
 */
export const useGeneralDashboard = (collegeIdParam) => {
  const collegeId = getEffectiveCollegeId(collegeIdParam);
  useBookRealtimeSync(collegeId);

  return useQuery({
    queryKey: ["generalDashboard", collegeId],
    queryFn: async () => {
      const endpoint =
        collegeId && collegeId !== "default"
          ? `/dashboards/general/${collegeId}/dashboard`
          : `/dashboards/general/home-data`;
      const { data } = await apiClient.get(endpoint);
      return data?.data || null;
    },
    enabled: Boolean(collegeId),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
};

/**
 * 1. Hook for fetching cached catalog statistics for a college
 */
export const useBookStats = (collegeIdParam) => {
  const collegeId = getEffectiveCollegeId(collegeIdParam);
  useBookRealtimeSync(collegeId);

  return useQuery({
    queryKey: ["bookStats", collegeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/college/${collegeId}/books/stats`);
      return (
        data?.data || {
          totalCatalogBooks: 0,
          addedThisMonth: 0,
          categoryBreakdown: [],
        }
      );
    },
    enabled: Boolean(collegeId),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchInterval: 60 * 1000,
  });
};

/**
 * 2. Hook for fetching new arrivals for a college (for carousels/widgets)
 */
export const useNewArrivals = (collegeIdParam, limit = 8) => {
  const collegeId = getEffectiveCollegeId(collegeIdParam);
  useBookRealtimeSync(collegeId);

  return useQuery({
    queryKey: ["newArrivals", collegeId, limit],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/college/${collegeId}/books/new-arrivals`,
        {
          params: { limit },
        },
      );
      return data?.data || [];
    },
    enabled: Boolean(collegeId),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
};

/**
 * 3. Hook for catalog search and paginated list queries
 */
export const useBookSearch = (collegeIdParam, filters = {}) => {
  const collegeId = getEffectiveCollegeId(collegeIdParam);
  useBookRealtimeSync(collegeId);

  const {
    q = "",
    search = "",
    category = "All",
    format = "All",
    available = "All",
    sortBy = "newest",
    page = 1,
    limit = 12,
  } = filters;

  const searchQuery = q || search;

  return useQuery({
    queryKey: [
      "books",
      collegeId,
      { searchQuery, category, format, available, sortBy, page, limit },
    ],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/college/${collegeId}/books/search`,
        {
          params: {
            q: searchQuery,
            category,
            format,
            available,
            sortBy,
            page,
            limit,
          },
        },
      );
      return {
        books: data?.data || [],
        pagination: data?.pagination || { page: 1, limit, total: 0, pages: 1 },
      };
    },
    enabled: Boolean(collegeId),
  });
};

/**
 * 4. Hook for fetching a single book detail
 */
export const useBookDetail = (collegeIdParam, bookId) => {
  const collegeId = getEffectiveCollegeId(collegeIdParam);
  useBookRealtimeSync(collegeId);

  return useQuery({
    queryKey: ["books", collegeId, "detail", bookId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/college/${collegeId}/books/${bookId}`,
      );
      return data?.data || null;
    },
    enabled: Boolean(collegeId && bookId),
  });
};

/**
 * 5. Hook for resolving batch book details (e.g. for saved bookmarks)
 */
export const useBatchBookDetails = (collegeIdParam, bookIds = []) => {
  const collegeId = getEffectiveCollegeId(collegeIdParam);
  useBookRealtimeSync(collegeId);

  const joinedIds = Array.isArray(bookIds) ? bookIds.join(",") : bookIds;

  return useQuery({
    queryKey: ["books", collegeId, "batch", joinedIds],
    queryFn: async () => {
      if (!joinedIds) return [];
      const { data } = await apiClient.get(
        `/college/${collegeId}/books/batch`,
        {
          params: { ids: joinedIds },
        },
      );
      return data?.data || [];
    },
    enabled: Boolean(collegeId && joinedIds),
  });
};
