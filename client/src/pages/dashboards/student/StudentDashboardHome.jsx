import { Clock, BookOpen, AlertCircle } from 'lucide-react';

const StudentDashboardHome = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Welcome back, John!</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Currently Borrowed Widget */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="text-indigo-600" />
              Currently Borrowed
            </h2>
          </div>
          
          <div className="space-y-4">
            {/* Mock Item */}
            <div className="flex items-center gap-4 p-4 border border-slate-100 rounded-lg bg-slate-50">
              <div className="w-16 h-20 bg-slate-200 rounded shrink-0"></div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">The Pragmatic Programmer</h3>
                <p className="text-sm text-slate-500">Due in 5 days</p>
                <div className="mt-2 flex gap-2">
                  <button className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium hover:bg-indigo-200">
                    Renew
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fines & Alerts Widget */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="text-amber-500" />
              Alerts
            </h2>
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 mb-4">
            <p className="font-bold">Pending Fines</p>
            <p className="text-2xl mt-1">₹0.00</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
            <p className="text-sm text-slate-600 flex items-center gap-2">
              <Clock size={16} />
              No overdue items. Great job!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardHome;
