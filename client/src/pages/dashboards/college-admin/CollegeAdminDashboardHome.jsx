const CollegeAdminDashboardHome = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">College Admin Dashboard</h1>
      <p className="text-slate-600">Overview of your specific college library, students, and fines.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Total Students</h2>
          <p className="text-3xl font-bold mt-2">1,200</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Active Loans</h2>
          <p className="text-3xl font-bold mt-2">350</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Overdue Loans</h2>
          <p className="text-3xl font-bold mt-2 text-danger">45</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Fines Collected</h2>
          <p className="text-3xl font-bold mt-2">₹12,500</p>
        </div>
      </div>
    </div>
  );
};

export default CollegeAdminDashboardHome;
