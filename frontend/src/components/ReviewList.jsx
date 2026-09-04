import { useState, useEffect, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getBookReviews, submitBookReview } from "../api/reviewApi";
import StarRatingInput from "./StarRatingInput";
import { MessageSquare, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

const ReviewList = ({ bookId, currentUserId }) => {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [clientError, setClientError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // TanStack Query useInfiniteQuery against F4.5
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["book-reviews", bookId],
    queryFn: ({ pageParam = 1 }) =>
      getBookReviews(bookId, { pageParam, limit: 10 }),
    getNextPageParam: (lastPage) =>
      lastPage?.hasMore ? (lastPage.page || 1) + 1 : undefined,
    initialPageParam: 1,
    enabled: !!bookId,
  });

  const allReviews = useMemo(
    () => data?.pages?.flatMap((page) => page?.data || []) || [],
    [data],
  );

  // Detect if user already has a review for this book and pre-fill for editing
  useEffect(() => {
    if (!allReviews.length) return;

    // The backend pins the user's own review first on page 1, or we check userId matching
    const ownReview =
      allReviews.find((r) => {
        const reviewUserId = r.userId?._id || r.userId;
        return (
          currentUserId &&
          reviewUserId &&
          String(reviewUserId) === String(currentUserId)
        );
      }) ||
      (allReviews[0]?.userId?._id === currentUserId ? allReviews[0] : null);

    if (ownReview && !isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Pre-filling edit form state when React Query reviews data is fetched
      setRating(ownReview.rating || 0);
      setText(ownReview.text || ownReview.comment || "");
      setIsEditing(true);
    }
  }, [allReviews, currentUserId, isEditing]);

  // Review Submission Mutation
  const submitMutation = useMutation({
    mutationFn: (reviewPayload) => submitBookReview(bookId, reviewPayload),
    onSuccess: (responseData) => {
      setSuccessMsg(
        responseData?.data?.status === "flagged"
          ? "Your review was submitted and is pending moderation."
          : "Your review has been published successfully!",
      );
      setClientError("");
      queryClient.invalidateQueries({ queryKey: ["book-reviews", bookId] });
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message ||
        "Failed to submit review. Please try again.";
      setClientError(msg);
      setSuccessMsg("");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Acceptance Criteria: attempting to submit with no star selected is blocked client-side, before any network request fires
    if (!rating || rating === 0) {
      setClientError("Please select a star rating before submitting.");
      return;
    }

    setClientError("");
    setSuccessMsg("");

    submitMutation.mutate({
      rating,
      text,
      bookId,
    });
  };

  const isSubmitDisabled = !rating || rating === 0 || submitMutation.isPending;

  return (
    <div className="space-y-8" data-testid="review-list-container">
      {/* Review Submission / Editing Form */}
      <form
        onSubmit={handleSubmit}
        className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4"
        data-testid="review-form"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          {isEditing ? "Your Review" : "Write a Review"}
        </h3>

        {/* Star Rating Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rating <span className="text-rose-500">*</span>
          </label>
          <StarRatingInput
            value={rating}
            onChange={(newRating) => {
              setRating(newRating);
              if (clientError) setClientError("");
            }}
          />
        </div>

        {/* Review Textarea */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Review Comments
          </label>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts about this book..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            data-testid="review-textarea"
          />
        </div>

        {/* Client / Server Feedback Messages */}
        {clientError && (
          <div
            className="p-3 text-sm text-rose-700 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg flex items-center gap-2"
            data-testid="review-error-message"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{clientError}</span>
          </div>
        )}

        {successMsg && (
          <div
            className="p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg flex items-center gap-2"
            data-testid="review-success-message"
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Submit Button - Disabled until star value is selected */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
            isSubmitDisabled
              ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow active:scale-95"
          }`}
          data-testid="submit-review-button"
        >
          {submitMutation.isPending && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          {isEditing ? "Update Review" : "Submit Review"}
        </button>
      </form>

      {/* Review List */}
      <div className="space-y-4">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
          Community Reviews
        </h4>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading reviews...</span>
          </div>
        ) : isError ? (
          <div className="p-4 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
            Failed to load reviews: {error?.message || "Error"}
          </div>
        ) : allReviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No reviews yet. Be the first to share your thoughts!
          </div>
        ) : (
          <div className="space-y-3" data-testid="reviews-feed">
            {allReviews.map((review) => {
              const isOwn =
                currentUserId &&
                String(review.userId?._id || review.userId) ===
                  String(currentUserId);

              return (
                <div
                  key={review._id}
                  className={`p-4 rounded-xl border transition-all ${
                    isOwn
                      ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
                      : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                  }`}
                  data-testid={`review-card-${review._id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {review.userId?.name || "Anonymous Reader"}
                        </span>
                        {isOwn && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded">
                            Your Review
                          </span>
                        )}
                        {review.status === "flagged" && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded">
                            Under Moderation
                          </span>
                        )}
                      </div>
                      <StarRatingInput
                        value={review.rating}
                        readOnly
                        size={16}
                        className="mt-1"
                      />
                    </div>
                    {review.createdAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {(review.text || review.comment) && (
                    <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {review.text || review.comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Button for Infinite Pagination */}
        {hasNextPage && (
          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
              data-testid="load-more-reviews-button"
            >
              {isFetchingNextPage && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {isFetchingNextPage ? "Loading more..." : "Load More Reviews"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewList;
