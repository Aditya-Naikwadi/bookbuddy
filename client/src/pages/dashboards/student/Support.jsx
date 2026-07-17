import { useState } from 'react';
import { useAcademicSupport } from '../../../hooks/useAcademicSupport';
import { PurchaseSuggestionForm } from '../../../components/student/support/PurchaseSuggestionForm';
import { ComplaintForm } from '../../../components/student/support/ComplaintForm';
import { FeedbackForm } from '../../../components/student/support/FeedbackForm';
import { SupportHistoryList } from '../../../components/student/support/SupportHistoryList';
import { FileText, Send, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const DRAFT_SUGGESTION_KEY = 'bb-draft-suggestion';
const DRAFT_COMPLAINT_KEY = 'bb-draft-complaint';
const DRAFT_FEEDBACK_KEY = 'bb-draft-feedback';

const Support = () => {
  const [mainTab, setMainTab] = useState('submit'); // 'submit' | 'history'
  const [subForm, setSubForm] = useState('suggestion'); // 'suggestion' | 'complaint' | 'feedback'

  // Fetch support data and mutation submission states
  const {
    complaints,
    mySuggestions,
    myFeedback,
    isLoading,
    refetchAll,
    submitSuggestion,
    isSubmittingSuggestion,
    submitComplaint,
    isSubmittingComplaint,
    submitFeedback,
    isSubmittingFeedback,
    liveAnnouncement,
  } = useAcademicSupport();

  const getDraft = (key, fallback) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      console.error('Failed to load draft', e);
      return fallback;
    }
  };

  // Controlled states for drafts
  const [suggestionFields, setSuggestionFields] = useState(() =>
    getDraft(DRAFT_SUGGESTION_KEY, { title: '', author: '', reason: '' })
  );
  const [complaintFields, setComplaintFields] = useState(() =>
    getDraft(DRAFT_COMPLAINT_KEY, { subject: '', description: '' })
  );
  const [feedbackFields, setFeedbackFields] = useState(() =>
    getDraft(DRAFT_FEEDBACK_KEY, { category: '', message: '', rating: 5 })
  );

  // Validation errors
  const [errors, setErrors] = useState({});
  const [successInfo, setSuccessInfo] = useState(null); // { type: '...', refId: '...' }

  // Update field and save draft
  const handleFieldChange = (formType, field, value) => {
    setSuccessInfo(null);
    setErrors((prev) => ({ ...prev, [field]: '' }));

    if (formType === 'suggestion') {
      const updated = { ...suggestionFields, [field]: value };
      setSuggestionFields(updated);
      localStorage.setItem(DRAFT_SUGGESTION_KEY, JSON.stringify(updated));
    } else if (formType === 'complaint') {
      const updated = { ...complaintFields, [field]: value };
      setComplaintFields(updated);
      localStorage.setItem(DRAFT_COMPLAINT_KEY, JSON.stringify(updated));
    } else if (formType === 'feedback') {
      const updated = { ...feedbackFields, [field]: value };
      setFeedbackFields(updated);
      localStorage.setItem(DRAFT_FEEDBACK_KEY, JSON.stringify(updated));
    }
  };

  // 1. Submit Purchase Suggestion
  const handleSuggestionSubmit = async () => {
    setErrors({});
    const newErrors = {};
    if (!suggestionFields.title?.trim()) {
      newErrors.title = 'Book title is required';
    }
    if (!suggestionFields.author?.trim()) {
      newErrors.author = 'Author name is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Move focus to first invalid field programmatically for accessibility
      setTimeout(() => {
        const firstErrKey = Object.keys(newErrors)[0];
        document.getElementById(`suggestion-${firstErrKey}`)?.focus();
      }, 50);
      return;
    }

    try {
      const response = await submitSuggestion(suggestionFields);
      setSuccessInfo({ type: 'Purchase Suggestion', refId: response._id });
      // Reset state and clear draft
      setSuggestionFields({ title: '', author: '', reason: '' });
      localStorage.removeItem(DRAFT_SUGGESTION_KEY);
    } catch (err) {
      setErrors({ global: err.message || 'Failed to submit request' });
    }
  };

  // 2. Submit Complaint
  const handleComplaintSubmit = async () => {
    setErrors({});
    const newErrors = {};
    if (!complaintFields.subject) {
      newErrors.subject = 'Subject category selection is required';
    }
    if (!complaintFields.description?.trim()) {
      newErrors.description = 'Detailed description is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTimeout(() => {
        const firstErrKey = Object.keys(newErrors)[0];
        document.getElementById(`complaint-${firstErrKey}`)?.focus();
      }, 50);
      return;
    }

    try {
      const response = await submitComplaint(complaintFields);
      setSuccessInfo({ type: 'Complaint', refId: response._id });
      setComplaintFields({ subject: '', description: '' });
      localStorage.removeItem(DRAFT_COMPLAINT_KEY);
    } catch (err) {
      setErrors({ global: err.message || 'Failed to submit complaint' });
    }
  };

  // 3. Submit General Feedback
  const handleFeedbackSubmit = async () => {
    setErrors({});
    const newErrors = {};
    if (!feedbackFields.category) {
      newErrors.category = 'Feedback category is required';
    }
    if (!feedbackFields.message?.trim()) {
      newErrors.message = 'Feedback message is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTimeout(() => {
        const firstErrKey = Object.keys(newErrors)[0];
        document.getElementById(`feedback-${firstErrKey}`)?.focus();
      }, 50);
      return;
    }

    try {
      const response = await submitFeedback(feedbackFields);
      setSuccessInfo({ type: 'General Feedback', refId: response._id });
      setFeedbackFields({ category: '', message: '', rating: 5 });
      localStorage.removeItem(DRAFT_FEEDBACK_KEY);
    } catch (err) {
      setErrors({ global: err.message || 'Failed to submit feedback' });
    }
  };

  const isAnySubmitting = isSubmittingSuggestion || isSubmittingComplaint || isSubmittingFeedback;

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-4">
      {/* Accessibility Polite Announcement Region */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Heading */}
      <div className="border-b border-slate-200 pb-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Academic Support & Feedback</h1>
          <p className="text-xs text-slate-500 mt-1">
            Request new library resources, lodge complaints, or send general feedback to college admins.
          </p>
        </div>
      </div>

      {/* Main Tab Toggle System */}
      <div className="flex border-b border-slate-200" role="tablist" aria-label="Support sections">
        <button
          role="tab"
          aria-selected={mainTab === 'submit'}
          onClick={() => {
            setMainTab('submit');
            setSuccessInfo(null);
            setErrors({});
          }}
          className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all focus:outline-none focus:text-indigo-600 ${
            mainTab === 'submit'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Send size={15} />
            Submit a Request
          </span>
        </button>

        <button
          role="tab"
          aria-selected={mainTab === 'history'}
          onClick={() => {
            setMainTab('history');
            refetchAll();
          }}
          className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all focus:outline-none focus:text-indigo-600 ${
            mainTab === 'history'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <FileText size={15} />
            My Submissions
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      {mainTab === 'submit' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sub Form Segment Toggle (Minimize decision fatigue) */}
          <div className="md:col-span-1 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2 h-fit">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4 px-2">
              Request Type
            </h3>
            
            <button
              onClick={() => {
                setSubForm('suggestion');
                setSuccessInfo(null);
                setErrors({});
              }}
              className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 ${
                subForm === 'suggestion'
                  ? 'bg-indigo/10 text-indigo border border-indigo-200/50'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span>👍</span>
              <span>Purchase Suggestion</span>
            </button>

            <button
              onClick={() => {
                setSubForm('complaint');
                setSuccessInfo(null);
                setErrors({});
              }}
              className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 ${
                subForm === 'complaint'
                  ? 'bg-red-500/10 text-danger border border-red-200/50'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span>⚠️</span>
              <span>File Complaint</span>
            </button>

            <button
              onClick={() => {
                setSubForm('feedback');
                setSuccessInfo(null);
                setErrors({});
              }}
              className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 ${
                subForm === 'feedback'
                  ? 'bg-slate-100 text-slate-900 border border-slate-200'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span>💬</span>
              <span>Send Feedback</span>
            </button>
          </div>

          {/* Form Fields Panel */}
          <div className="md:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm relative">
            {/* Global Error Banner */}
            {errors.global && (
              <div className="mb-4 p-3 bg-red-50 text-red-800 border border-red-200 rounded-2xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                <span>{errors.global}</span>
              </div>
            )}

            {/* Success Feedback Display */}
            {successInfo && (
              <div
                className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 space-y-2 animate-in fade-in"
                role="status"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-emerald-500" size={18} />
                  <span className="font-extrabold text-sm">{successInfo.type} Submitted!</span>
                </div>
                <p className="text-[10px] text-emerald-700 leading-relaxed">
                  Your request was registered successfully. Reference code for tracking: <strong className="font-mono text-slate-800 select-all">{successInfo.refId}</strong>. You can monitor its review status in the "My Submissions" logs.
                </p>
              </div>
            )}

            {/* Dynamic Form Render */}
            {subForm === 'suggestion' && (
              <PurchaseSuggestionForm
                values={suggestionFields}
                errors={errors}
                isPending={isAnySubmitting}
                onFieldChange={(field, val) => handleFieldChange('suggestion', field, val)}
                onSubmit={handleSuggestionSubmit}
              />
            )}

            {subForm === 'complaint' && (
              <ComplaintForm
                values={complaintFields}
                errors={errors}
                isPending={isAnySubmitting}
                onFieldChange={(field, val) => handleFieldChange('complaint', field, val)}
                onSubmit={handleComplaintSubmit}
              />
            )}

            {subForm === 'feedback' && (
              <FeedbackForm
                values={feedbackFields}
                errors={errors}
                isPending={isAnySubmitting}
                onFieldChange={(field, val) => handleFieldChange('feedback', field, val)}
                onSubmit={handleFeedbackSubmit}
              />
            )}
          </div>
        </div>
      ) : (
        /* History panel */
        isLoading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <RefreshCw className="animate-spin text-indigo-500" size={32} />
            <span>Retrieving historical submissions...</span>
          </div>
        ) : (
          <SupportHistoryList
            suggestions={mySuggestions}
            complaints={complaints}
            feedback={myFeedback}
          />
        )
      )}
    </div>
  );
};

export default Support;
