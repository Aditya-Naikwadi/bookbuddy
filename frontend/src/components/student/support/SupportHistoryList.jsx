import { useState } from "react";
import {
  MessageSquare,
  AlertTriangle,
  ThumbsUp,
  Calendar,
  Star,
} from "lucide-react";
import { StatusBadge } from "../../common/StatusBadge";

export const SupportHistoryList = ({
  suggestions = [],
  complaints = [],
  feedback = [],
}) => {
  const [activeTab, setActiveTab] = useState("suggestions");

  const formatDate = (dateInput) => {
    const d = new Date(dateInput);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Sub-tab navigation */}
      <div
        className="flex border-b border-slate-100 pb-px"
        role="tablist"
        aria-label="Support history categories"
      >
        <button
          role="tab"
          aria-selected={activeTab === "suggestions"}
          onClick={() => setActiveTab("suggestions")}
          className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all focus:outline-none focus:text-indigo-600 ${
            activeTab === "suggestions"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <ThumbsUp size={14} />
            Book Requests ({suggestions.length})
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === "complaints"}
          onClick={() => setActiveTab("complaints")}
          className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all focus:outline-none focus:text-indigo-600 ${
            activeTab === "complaints"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <AlertTriangle size={14} />
            Complaints ({complaints.length})
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === "feedback"}
          onClick={() => setActiveTab("feedback")}
          className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all focus:outline-none focus:text-indigo-600 ${
            activeTab === "feedback"
              ? "border-indigo-600 text-indigo-600 font-extrabold"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <MessageSquare size={14} />
            Feedback ({feedback.length})
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="space-y-4">
        {/* Panel 1: Suggestions */}
        {activeTab === "suggestions" && (
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                You have not requested any books yet.
              </div>
            ) : (
              suggestions.map((item) => (
                <div
                  key={item._id}
                  className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-2"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Author: {item.author}
                      </p>
                    </div>
                    <StatusBadge status={item.status} size="sm" showIcon />
                  </div>

                  {item.reason && (
                    <p className="text-xs text-slate-600 leading-normal font-medium bg-white p-3 rounded-xl border border-slate-100">
                      <strong>Reason:</strong> {item.reason}
                    </p>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  {/* Admin notes */}
                  {item.adminNote && (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-800 space-y-1">
                      <p className="font-bold text-[10px] uppercase tracking-wider text-indigo-500">
                        Admin Response
                      </p>
                      <p className="leading-relaxed font-medium">
                        {item.adminNote}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Panel 2: Complaints */}
        {activeTab === "complaints" && (
          <div className="space-y-3">
            {complaints.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                You have not filed any complaints.
              </div>
            ) : (
              complaints.map((item) => (
                <div
                  key={item._id}
                  className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-2.5"
                >
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-bold text-sm text-slate-800">
                      Category: {item.subject}
                    </h4>
                    <StatusBadge status={item.status} size="sm" showIcon />
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-100">
                    {item.description}
                  </p>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  {/* Resolution response */}
                  {item.status === "resolved" && item.resolutionMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 space-y-1">
                      <p className="font-bold text-[10px] uppercase tracking-wider text-emerald-600">
                        Resolution Update
                      </p>
                      <p className="leading-relaxed font-medium">
                        {item.resolutionMessage}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Panel 3: Feedback */}
        {activeTab === "feedback" && (
          <div className="space-y-3">
            {feedback.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                You have not submitted feedback.
              </div>
            ) : (
              feedback.map((item) => (
                <div
                  key={item._id}
                  className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-2"
                >
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      Category: {item.category}
                    </span>

                    {/* Star icons */}
                    {item.rating && (
                      <div
                        className="flex gap-0.5 text-amber-400 shrink-0"
                        aria-label={`Rating: ${item.rating} out of 5 stars`}
                      >
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            fill={i < item.rating ? "currentColor" : "none"}
                            className={
                              i < item.rating
                                ? "text-amber-400"
                                : "text-slate-200"
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-normal font-medium bg-white p-3 rounded-xl border border-slate-100">
                    {item.message}
                  </p>

                  <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(item.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportHistoryList;
