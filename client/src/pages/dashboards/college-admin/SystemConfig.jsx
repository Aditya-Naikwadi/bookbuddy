import { BellRing, Wand2, Mail } from 'lucide-react';

const SystemConfig = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">System Configuration</h1>
      <p className="text-slate-600">Manage automated notification triggers and recommendation engine parameters.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notification Triggers */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <BellRing className="text-indigo-600" />
            <h2 className="text-xl font-bold">Notification Triggers</h2>
          </div>
          
          <div className="space-y-6 border-b border-slate-100 pb-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Pre-Due Reminders</h3>
                <p className="text-xs text-slate-500">Send an email before items are due.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <div className="pl-4 border-l-2 border-indigo-100">
              <label className="text-sm font-medium text-slate-700">Days before due date</label>
              <input type="number" defaultValue={2} className="mt-1 w-24 p-2 border border-slate-300 rounded" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Overdue Alerts</h3>
                <p className="text-xs text-slate-500">Send email and SMS on day of overdue.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
          
          <button className="flex items-center justify-center gap-2 w-full border border-slate-300 bg-white text-slate-700 font-medium py-2 rounded-lg hover:bg-slate-50">
            <Mail size={18} /> Configure Email Templates
          </button>
        </div>

        {/* Recommendation Engine Tuning */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <Wand2 className="text-indigo-600" />
            <h2 className="text-xl font-bold">Recommendation Engine</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">Adjust weights for the ML-driven catalog recommendations.</p>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Course Syllabus Keyword Match</span>
                <span className="text-sm text-indigo-600 font-bold">60%</span>
              </div>
              <input type="range" min="0" max="100" defaultValue="60" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Peer Borrowing History</span>
                <span className="text-sm text-indigo-600 font-bold">30%</span>
              </div>
              <input type="range" min="0" max="100" defaultValue="30" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Global Trend Bias</span>
                <span className="text-sm text-indigo-600 font-bold">10%</span>
              </div>
              <input type="range" min="0" max="100" defaultValue="10" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
            </div>
          </div>
          <button type="button" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 mt-8">
            Apply New Weights
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;
