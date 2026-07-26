import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../../ui/Button";

export const ComplaintForm = ({
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
          <AlertTriangle className="text-danger w-5 h-5" />
          File an Official Complaint
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Submit concerns regarding library facilities, service staff conduct,
          or digital portal bugs.
        </p>
      </div>

      <p className="text-[10px] text-slate-400 font-bold">
        * indicates a required field
      </p>

      {/* serious tone policy information */}
      <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl text-[10px] text-slate-600 leading-relaxed font-medium">
        <strong className="text-slate-800 font-bold">Privacy Policy:</strong>{" "}
        Complaints are logged securely to your account for administrative
        review. Issues are typically processed and resolved within 3-5 business
        days.
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
        noValidate
      >
        {/* Category Choice Select */}
        <div className="space-y-1">
          <label
            htmlFor="complaint-subject"
            className="block text-xs font-bold text-slate-700"
          >
            Subject Category <span className="text-red-500">*</span>
          </label>
          <select
            id="complaint-subject"
            value={values.subject || ""}
            onChange={(e) => onFieldChange("subject", e.target.value)}
            disabled={isPending}
            className={`w-full p-2.5 text-xs border rounded-xl focus:ring-2 focus:ring-red-500/50 focus:outline-none bg-white text-slate-700 ${
              errors.subject
                ? "border-red-500 bg-red-50/10"
                : "border-slate-200"
            }`}
            aria-required="true"
            aria-describedby={errors.subject ? "error-subject" : undefined}
          >
            <option value="">Select Category</option>
            <option value="Facility Issue">Facility Issue</option>
            <option value="Staff Conduct">Staff Conduct</option>
            <option value="Digital Portal Bug">Digital Portal Bug</option>
            <option value="Book Condition">Book Condition</option>
            <option value="Other">Other</option>
          </select>
          {errors.subject && (
            <p
              id="error-subject"
              className="text-[10px] font-bold text-red-600"
              role="alert"
            >
              {errors.subject}
            </p>
          )}
        </div>

        {/* Description textarea */}
        <div className="space-y-1">
          <label
            htmlFor="complaint-description"
            className="block text-xs font-bold text-slate-700"
          >
            Detailed Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="complaint-description"
            rows="4"
            value={values.description || ""}
            onChange={(e) => onFieldChange("description", e.target.value)}
            disabled={isPending}
            className={`w-full p-2.5 text-xs border rounded-xl focus:ring-2 focus:ring-red-500/50 focus:outline-none resize-none ${
              errors.description
                ? "border-red-500 bg-red-50/10"
                : "border-slate-200"
            }`}
            placeholder="Please provide complete details, dates, and locations if applicable..."
            aria-required="true"
            aria-describedby={
              errors.description ? "error-description" : undefined
            }
          />
          {errors.description && (
            <p
              id="error-description"
              className="text-[10px] font-bold text-red-600"
              role="alert"
            >
              {errors.description}
            </p>
          )}
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-11 bg-danger hover:bg-red-600 text-white font-bold rounded-2xl shadow-md hover:shadow-red-500/25 flex items-center justify-center gap-2 focus:ring-2 focus:ring-red-500"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Submitting Complaint...</span>
            </>
          ) : (
            <span>Submit Complaint</span>
          )}
        </Button>
      </form>
    </div>
  );
};

export default ComplaintForm;
