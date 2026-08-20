import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellCheck, BookOpen, AlertCircle, Check } from "lucide-react";
import { Button } from "./ui/Button";
import { getWatchStatus, watchBook, unwatchBook } from "../api/watchApi";
import apiClient from "../api/client";
import ReviewList from "./ReviewList";

export const BookDetail = ({ book, currentUserId }) => {
  const queryClient = useQueryClient();
  const [holdMessage, setHoldMessage] = useState(null);

  const bookId = book?._id;

  // Server-side persisted watch status query
  const { data: watchData, isLoading: isWatchLoading } = useQuery({
    queryKey: ["watch-status", bookId],
    queryFn: () => getWatchStatus(bookId),
    enabled: !!bookId && book?.copiesAvailable === 0,
  });

  const isWatching = watchData?.isWatching || false;

  // Watch mutation (POST /api/books/:id/watch)
  const watchMutation = useMutation({
    mutationFn: () => watchBook(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watch-status", bookId] });
    },
  });

  // Unwatch mutation (DELETE /api/books/:id/watch)
  const unwatchMutation = useMutation({
    mutationFn: () => unwatchBook(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watch-status", bookId] });
    },
  });

  // Direct One-Tap Hold placement handler
  const handlePlaceHold = async () => {
    try {
      const res = await apiClient.post("/dashboards/student/reservations", {
        bookId,
      });
      setHoldMessage({
        type: "success",
        text: res.data.message || "Hold placed successfully!",
      });
    } catch (err) {
      setHoldMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Failed to place hold. Please try again.",
      });
    }
  };

  if (!book) return null;

  const isOutOfStock = book.copiesAvailable === 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 glass-panel border border-edge/30 rounded-2xl">
      {/* Book Summary Card */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Book Cover */}
        <div className="w-36 h-48 bg-surface/50 rounded-xl border border-edge/40 flex flex-col items-center justify-center relative overflow-hidden flex-shrink-0">
          {book.coverImage ? (
            <img
              src={book.coverImage}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center text-muted/40">
              <BookOpen size={48} />
              <span className="text-[10px] mt-2 font-bold uppercase tracking-wider">
                No Cover
              </span>
            </div>
          )}
        </div>

        {/* Book Details */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full bg-ember/10 text-ember border border-ember/20">
              {book.category || "General"}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                !isOutOfStock
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-danger/15 text-danger border border-danger/30"
              }`}
            >
              {!isOutOfStock
                ? `Available (${book.copiesAvailable} left)`
                : "Out of Stock"}
            </span>
          </div>

          <h1 className="text-2xl font-serif font-bold text-ink leading-snug">
            {book.title}
          </h1>
          <p className="text-sm text-muted font-medium">By {book.author}</p>

          {book.isbn && (
            <p className="text-xs text-muted/70">ISBN: {book.isbn}</p>
          )}

          {/* Action Button Section */}
          <div className="pt-4 flex flex-wrap items-center gap-3">
            {!isOutOfStock ? (
              <Button
                variant="primary"
                onClick={handlePlaceHold}
                className="px-6 h-10 text-sm font-semibold"
              >
                Borrow Book
              </Button>
            ) : (
              <>
                {/* Hold Placement Button */}
                <Button
                  variant="primary"
                  onClick={handlePlaceHold}
                  className="px-5 h-10 text-sm font-semibold"
                >
                  Join Queue
                </Button>

                {/* "Notify me when available" / "Watching" Button */}
                {isWatching ? (
                  <Button
                    variant="outline"
                    data-testid="watching-button"
                    onClick={() => unwatchMutation.mutate()}
                    disabled={unwatchMutation.isPending || isWatchLoading}
                    className="px-5 h-10 text-sm font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-2"
                  >
                    <BellCheck size={18} />
                    <span>Watching</span>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    data-testid="notify-me-button"
                    onClick={() => watchMutation.mutate()}
                    disabled={watchMutation.isPending || isWatchLoading}
                    className="px-5 h-10 text-sm font-semibold border border-edge/40 hover:border-ember text-ink flex items-center gap-2"
                  >
                    <Bell size={18} />
                    <span>Notify me when available</span>
                  </Button>
                )}
              </>
            )}
          </div>

          {holdMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                holdMessage.type === "success"
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-danger/15 text-danger border border-danger/30"
              }`}
            >
              {holdMessage.type === "success" ? (
                <Check size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{holdMessage.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Review List & Community Rating Component */}
      <div className="border-t border-edge/20 pt-6">
        <ReviewList bookId={bookId} currentUserId={currentUserId} />
      </div>
    </div>
  );
};

export default BookDetail;
