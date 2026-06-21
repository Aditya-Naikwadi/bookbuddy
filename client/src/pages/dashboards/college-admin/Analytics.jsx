import { LineChart, TrendingUp, Users, BookOpen } from 'lucide-react';

const Analytics = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Predictive Analytics & Reporting</h1>
      <p className="text-slate-600">Data-driven insights to optimize collection development and library resources.</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <span className="text-success text-sm font-bold flex items-center">+12%</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Monthly Circulation</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">4,209</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Users size={24} />
            </div>
            <span className="text-success text-sm font-bold flex items-center">+5%</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Active Patrons</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">1,840</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <BookOpen size={24} />
            </div>
            <span className="text-slate-400 text-sm font-bold flex items-center">Stable</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Collection Utilization</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">68%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Mockup */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <LineChart className="text-indigo-600" />
            <h2 className="text-xl font-bold">Predictive Demand</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">AI models predict a surge in demand for the following categories next month based on syllabus analysis.</p>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Data Science & ML</span>
                <span className="text-sm text-amber-600 font-bold">High Risk of Shortage</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-slate-700">Classical Literature</span>
                <span className="text-sm text-success font-bold">Adequate Stock</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div className="bg-success h-2.5 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>
          <button className="mt-6 w-full border border-indigo-200 text-indigo-700 font-medium py-2 rounded-lg hover:bg-indigo-50">
            Generate Acquisition Report
          </button>
        </div>

        {/* Detailed Reporting */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold mb-6">Scheduled Reports</h2>
          <div className="space-y-3">
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900">End of Month Circulation</h4>
                <p className="text-xs text-slate-500 mt-1">Sent to Dean on 1st of every month.</p>
              </div>
              <button className="text-indigo-600 text-sm font-medium hover:underline">Edit</button>
            </div>
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900">Overdue Fines Audit</h4>
                <p className="text-xs text-slate-500 mt-1">Sent to Finance Dept weekly.</p>
              </div>
              <button className="text-indigo-600 text-sm font-medium hover:underline">Edit</button>
            </div>
          </div>
          <button className="mt-4 w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800">
            Create Custom Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
