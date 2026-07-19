import { ThumbsUp, Loader2 } from 'lucide-react';
import { Button } from '../../ui/Button';

export const PurchaseSuggestionForm = ({
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
          <ThumbsUp className="text-indigo-600 w-5 h-5" />
          Request a New Book
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Can't find a resource in our catalog? Suggest it for acquisition.
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
        {/* Book Title Input */}
        <div className="space-y-1">
          <label
            htmlFor="suggestion-title"
            className="block text-xs font-bold text-slate-700"
          >
            Book Title <span className="text-red-500">*</span>
          </label>
          <input
            id="suggestion-title"
            type="text"
            value={values.title || ''}
            onChange={(e) => onFieldChange('title', e.target.value)}
            disabled={isPending}
            className={`w-full p-2.5 text-xs border rounded-xl focus:ring-2 focus:ring-indigo-600/50 focus:outline-none ${
              errors.title ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
            }`}
            placeholder="e.g. Introduction to Algorithms"
            aria-required="true"
            aria-describedby={errors.title ? 'error-title' : undefined}
          />
          {errors.title && (
            <p
              id="error-title"
              className="text-[10px] font-bold text-red-600"
              role="alert"
            >
              {errors.title}
            </p>
          )}
        </div>

        {/* Author Input */}
        <div className="space-y-1">
          <label
            htmlFor="suggestion-author"
            className="block text-xs font-bold text-slate-700"
          >
            Author <span className="text-red-500">*</span>
          </label>
          <input
            id="suggestion-author"
            type="text"
            value={values.author || ''}
            onChange={(e) => onFieldChange('author', e.target.value)}
            disabled={isPending}
            className={`w-full p-2.5 text-xs border rounded-xl focus:ring-2 focus:ring-indigo-600/50 focus:outline-none ${
              errors.author ? 'border-red-500 bg-red-50/10' : 'border-slate-200'
            }`}
            placeholder="e.g. Thomas H. Cormen"
            aria-required="true"
            aria-describedby={errors.author ? 'error-author' : undefined}
          />
          {errors.author && (
            <p
              id="error-author"
              className="text-[10px] font-bold text-red-600"
              role="alert"
            >
              {errors.author}
            </p>
          )}
        </div>

        {/* Reason/Justification Textarea */}
        <div className="space-y-1">
          <label
            htmlFor="suggestion-reason"
            className="block text-xs font-bold text-slate-700"
          >
            Reason for Acquisition
          </label>
          <textarea
            id="suggestion-reason"
            rows="3"
            value={values.reason || ''}
            onChange={(e) => onFieldChange('reason', e.target.value)}
            disabled={isPending}
            className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/50 focus:outline-none resize-none"
            placeholder="Explain why this book is useful for your studies..."
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-11 bg-indigo hover:bg-indigo-600 text-white font-bold rounded-2xl shadow-md hover:shadow-indigo-500/25 flex items-center justify-center gap-2 focus:ring-2 focus:ring-indigo-600"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Submitting Request...</span>
            </>
          ) : (
            <span>Submit Request</span>
          )}
        </Button>
      </form>
    </div>
  );
};

export default PurchaseSuggestionForm;
