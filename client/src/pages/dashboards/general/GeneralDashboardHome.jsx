const GeneralDashboardHome = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">General Public Dashboard</h1>
      <p className="text-slate-600">Public view of the library catalog, hours, and announcements.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
          <h2 className="text-xl font-bold mb-4">Announcements</h2>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-indigo-900">
            <strong>Maintenance Notice:</strong> Library will be closed on Friday for maintenance.
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <h2 className="text-sm text-slate-500 font-medium">Library Hours</h2>
            <p className="text-lg font-bold mt-1">8:00 AM - 10:00 PM</p>
          </div>
          <div>
            <h2 className="text-sm text-slate-500 font-medium">Total Catalog Books</h2>
            <p className="text-lg font-bold mt-1">15,000</p>
          </div>
          <div>
            <h2 className="text-sm text-slate-500 font-medium">New Arrivals</h2>
            <p className="text-lg font-bold mt-1">120</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralDashboardHome;
