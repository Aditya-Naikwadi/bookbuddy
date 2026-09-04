import { MessageSquare, Loader2, Star } from "lucide-react";
import { Button } from "../../ui/Button";

export const FeedbackForm = ({
  values = {},
  errors = {},
  isPending = false,
  onFieldChange,
  onSubmit,
}) => {
  return (
    <div className="space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="text-success w-5 h-5" />
          Send General Feedback
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Share your suggestions or compliments to help us build a better
          library experience.
        </p>
      </div>

      <p className="text-[10px] text-slate-400 font-bold">
        * indicates a required field
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
        noValidate
      >
        {/* Rating Star Selection Grid */}
        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-slate-700">
            Rate your experience
          </span>
          <div
            className="flex gap-2"
            role="group"
            aria-label="Rating out of 5 stars"
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const rating = values.rating || 0;
              const isSelected = star <= rating;

              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => onFieldChange("rating", star)}
                  disabled={isPending}
                  className={`p-1 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
                    isSelected
                      ? "text-amber-400"
                      : "text-slate-200 hover:text-amber-200"
                  }`}
                  aria-label={`Rate ${star} Star${star > 1 ? "s" : ""}`}
                  aria-pressed={rating === star}
                >
                  <Star size={24} fill={isSelected ? "currentColor" : "none"} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Choice Select */}
        <div className="space-y-1">
          <label
            htmlFor="feedback-category"
            className="block text-xs font-bold text-slate-700"
          >
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="feedback-category"
            value={values.category || ""}
            onChange={(e) => onFieldChange("category", e.target.value)}
            disabled={isPending}
            className={`w-full p-2.5 text-xs border rounded-xl focus:ring-2 focus:ring-slate-400 focus:outline-none bg-white text-slate-700 ${
              errors.category
                ? "border-red-500 bg-red-50/10"
                : "border-slate-200"
            }`}
            aria-required="true"
            aria-describedby={errors.category ? "error-category" : undefined}
          >
            <option value="">Select Category</option>
            <option value="general">General Library</option>
            <option value="facility">Facility & Workstations</option>
            <option value="catalog">Books Catalog</option>
            <option value="service">Librarian Services</option>
          </select>
          {errors.category && (
            <p
              id="error-category"
              className="text-[10px] font-bold text-red-600"
              role="alert"
            >
              {errors.category}
            </p>
          )}
        </div>

        {/* Message Input */}
        <div className="space-y-1">
          <label
            htmlFor="feedback-message"
            className="block text-xs font-bold text-slate-700"
          >
            Your Feedback Message <span className="text-red-500">*</span>
          </label>
          <textarea
            id="feedback-message"
            rows="3"
            value={values.message || ""}
            onChange={(e) => onFieldChange("message", e.target.value)}
            disabled={isPending}
            className={`w-full p-2.5 text-xs border rounded-xl focus:ring-2 focus:ring-slate-400 focus:outline-none resize-none ${
              errors.message
                ? "border-red-500 bg-red-50/10"
                : "border-slate-200"
            }`}
            placeholder="Tell us what you love or what could be better..."
            aria-required="true"
            aria-describedby={errors.message ? "error-message" : undefined}
          />
          {errors.message && (
            <p
              id="error-message"
              className="text-[10px] font-bold text-red-600"
              role="alert"
            >
              {errors.message}
            </p>
          )}
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 focus:ring-2 focus:ring-slate-700"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Sending Feedback...</span>
            </>
          ) : (
            <span>Send Feedback</span>
          )}
        </Button>
      </form>
    </div>
  );
};

export default FeedbackForm;
