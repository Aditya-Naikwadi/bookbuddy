import { MessageSquare, ThumbsUp, AlertTriangle } from 'lucide-react';

const Support = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Support & Feedback</h1>
      <p className="text-slate-600">Help us improve the library experience or report an issue.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Book Recommendation (Acquisition) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <ThumbsUp className="text-indigo-600" />
            <h2 className="text-xl font-bold">Request a New Book</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">Can't find what you need? Suggest it for acquisition.</p>
          <form className="space-y-4">
            <input type="text" placeholder="Book Title" className="w-full p-2 border border-slate-300 rounded-lg" />
            <input type="text" placeholder="Author" className="w-full p-2 border border-slate-300 rounded-lg" />
            <button type="button" className="w-full bg-indigo-50 text-indigo-700 font-medium py-2 rounded-lg hover:bg-indigo-100">
              Submit Request
            </button>
          </form>
        </div>

        {/* Complaint Box */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-danger" />
            <h2 className="text-xl font-bold">File a Complaint</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">Report an issue with the facility, staff, or digital portal.</p>
          <form className="space-y-4">
            <select className="w-full p-2 border border-slate-300 rounded-lg text-slate-700">
              <option>Select Category</option>
              <option>Facility Issue</option>
              <option>Staff Conduct</option>
              <option>Digital Portal Bug</option>
            </select>
            <textarea placeholder="Describe the issue..." rows="3" className="w-full p-2 border border-slate-300 rounded-lg resize-none"></textarea>
            <button type="button" className="w-full bg-danger/10 text-danger font-medium py-2 rounded-lg hover:bg-danger/20">
              Submit Complaint
            </button>
          </form>
        </div>

        {/* General Feedback System */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="text-success" />
            <h2 className="text-xl font-bold">General Feedback</h2>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-medium text-slate-700">Rate your experience:</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} className="text-slate-300 hover:text-amber-400 text-2xl">★</button>
              ))}
            </div>
          </div>
          <textarea placeholder="Tell us what you love or what could be better..." rows="3" className="w-full p-2 border border-slate-300 rounded-lg resize-none mb-4"></textarea>
          <button type="button" className="bg-slate-900 text-white px-6 font-medium py-2 rounded-lg hover:bg-slate-800">
            Send Feedback
          </button>
        </div>
      </div>
    </div>
  );
};

export default Support;
