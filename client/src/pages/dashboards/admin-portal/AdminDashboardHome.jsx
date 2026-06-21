const AdminDashboardHome = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Global Admin Portal</h1>
      <p className="text-slate-600">Overview of system health, all colleges, and global metrics.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Total Colleges</h2>
          <p className="text-3xl font-bold mt-2">15</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Total Users</h2>
          <p className="text-3xl font-bold mt-2">5,000</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">Active Subscriptions</h2>
          <p className="text-3xl font-bold mt-2">12</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-sm text-slate-500 font-medium">System Status</h2>
          <p className="text-3xl font-bold mt-2 text-success">Healthy</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardHome;
