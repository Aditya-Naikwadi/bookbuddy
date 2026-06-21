import { FileCheck, Megaphone, CheckCircle, XCircle } from 'lucide-react';

const GlobalContentModeration = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Global Content & Moderation</h1>
      <p className="text-slate-600">Approve E-Resources uploaded by colleges and push global announcements.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* E-Resource Approval Queue */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <FileCheck className="text-indigo-600" />
            <h2 className="text-xl font-bold">E-Resource Approval Queue</h2>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Tech Institute Research Journal 2025</h4>
                  <p className="text-xs text-slate-500 mt-1">Uploaded by: Tech Institute Branch Admin</p>
                </div>
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">Pending Review</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-white border border-slate-300 text-slate-700 py-1.5 rounded text-sm hover:bg-slate-100">Preview PDF</button>
                <button className="flex items-center justify-center bg-success/10 text-success-800 px-3 rounded hover:bg-success/20"><CheckCircle size={18} /></button>
                <button className="flex items-center justify-center bg-danger/10 text-danger-800 px-3 rounded hover:bg-danger/20"><XCircle size={18} /></button>
              </div>
            </div>

            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Historical Maps of the Campus</h4>
                  <p className="text-xs text-slate-500 mt-1">Uploaded by: State University Central</p>
                </div>
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">Pending Review</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-white border border-slate-300 text-slate-700 py-1.5 rounded text-sm hover:bg-slate-100">Preview Images</button>
                <button className="flex items-center justify-center bg-success/10 text-success-800 px-3 rounded hover:bg-success/20"><CheckCircle size={18} /></button>
                <button className="flex items-center justify-center bg-danger/10 text-danger-800 px-3 rounded hover:bg-danger/20"><XCircle size={18} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Announcements */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <Megaphone className="text-indigo-600" />
            <h2 className="text-xl font-bold">Global Announcements</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">Push a banner notification to all users across all branches (Students and College Admins).</p>
          
          <form className="space-y-4 border-b border-slate-100 pb-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Announcement Title</label>
              <input type="text" placeholder="e.g. System Maintenance This Weekend" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message Body</label>
              <textarea rows={3} placeholder="The BookBuddy system will be down..." className="w-full p-2 border border-slate-300 rounded-lg focus:ring-indigo-500"></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
              <select className="w-full p-2 border border-slate-300 rounded-lg bg-white">
                <option>Information (Blue)</option>
                <option>Warning (Yellow)</option>
                <option>Critical Alert (Red)</option>
              </select>
            </div>
            <button type="button" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800">
              Publish Global Banner
            </button>
          </form>

          <div>
            <h3 className="font-bold text-sm mb-3 text-slate-700">Active Banners</h3>
            <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-800 text-sm rounded-lg flex justify-between items-center">
              <span><strong>Info:</strong> Welcome back to the Fall Semester!</span>
              <button className="text-indigo-600 hover:text-indigo-900 font-medium text-xs">Revoke</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalContentModeration;
