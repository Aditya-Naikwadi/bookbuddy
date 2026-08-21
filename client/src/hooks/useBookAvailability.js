import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useSocket from "./useSocket";

/**
 * Hook to listen for real-time book:availability_updated events via Socket.io
 * and update TanStack Query cache in-place. Fallbacks to a 60-second periodic
 * reconciliation revalidation if socket is disconnected.
 */
export const useBookAvailability = (collegeId, refetchCallback) => {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleAvailabilityUpdate = (payload) => {
      if (!payload || !payload.bookId) return;

      const targetId = payload.bookId.toString();
      const newAvailableCopies = payload.availableCopies;

      // 1. Update all book search query caches matching query key ['bookSearch', collegeId]
      queryClient.setQueriesData(
        { queryKey: ["bookSearch", collegeId] },
        (oldData) => {
          if (!oldData || !oldData.books || !Array.isArray(oldData.books))
            return oldData;

          const updatedBooks = oldData.books.map((book) => {
            const bId = (book._id || book.id)?.toString();
            if (bId === targetId) {
              return {
                ...book,
                availableCopies: newAvailableCopies,
                availabilityStatus:
                  newAvailableCopies > 0 ? "available" : "checked_out",
              };
            }
            return book;
          });

          return { ...oldData, books: updatedBooks };
        },
      );

      // 2. Update general dashboard payload query cache matching query key ['generalDashboard', collegeId]
      queryClient.setQueryData(["generalDashboard", collegeId], (oldData) => {
        if (!oldData) return oldData;

        const updatedPopular = (oldData.popularBooks || []).map((book) => {
          const bId = (book._id || book.id)?.toString();
          if (bId === targetId) {
            return {
              ...book,
              availableCopies: newAvailableCopies,
              availabilityStatus:
                newAvailableCopies > 0 ? "available" : "checked_out",
            };
          }
          return book;
        });

        return { ...oldData, popularBooks: updatedPopular };
      });
    };

    socket.on("book:availability_updated", handleAvailabilityUpdate);

    return () => {
      socket.off("book:availability_updated", handleAvailabilityUpdate);
    };
  }, [socket, isConnected, queryClient, collegeId]);

  // 60-Second Periodic Reconciliation Fallback
  useEffect(() => {
    if (!refetchCallback) return;

    const interval = setInterval(() => {
      refetchCallback();
    }, 60000);

    return () => clearInterval(interval);
  }, [refetchCallback]);

  return { isConnected };
};

export default useBookAvailability;
