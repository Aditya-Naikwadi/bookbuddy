import { DoorOpen, MonitorSmartphone, Settings } from 'lucide-react';

const Facilities = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Facilities & Spaces</h1>
      <p className="text-slate-600">Manage study rooms and smart PC lab reservations.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resource Scheduling */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <DoorOpen className="text-indigo-600" />
              <h2 className="text-xl font-bold">Study Rooms</h2>
            </div>
            <button className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1">
              <Settings size={14} /> Configure
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900">Room 101 (Collab Space)</h4>
                <p className="text-sm text-slate-500 mt-1">Status: <span className="text-danger font-medium">Occupied</span> until 2:00 PM</p>
                <p className="text-xs text-slate-400 mt-1">Booked by: Study Group A</p>
              </div>
              <button className="bg-white border border-slate-300 text-slate-600 px-3 py-1 rounded text-sm hover:bg-slate-100">Release</button>
            </div>
            <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900">Room 102 (Quiet Focus)</h4>
                <p className="text-sm text-slate-500 mt-1">Status: <span className="text-success font-medium">Available</span></p>
              </div>
              <button className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded text-sm hover:bg-indigo-100">Block</button>
            </div>
          </div>
        </div>

        {/* Smart Space & PC Reservation */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <MonitorSmartphone className="text-indigo-600" />
            <h2 className="text-xl font-bold">Digital Lab Terminals</h2>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Terminal Map Mockup */}
            {[1, 2, 3, 4, 5, 6, 7, 8].map(term => (
              <div 
                key={term}
                className={`p-3 rounded border flex flex-col items-center justify-center ${
                  term % 3 === 0 ? 'bg-danger/10 border-danger/20 text-danger' : 
                  term === 5 ? 'bg-amber-100 border-amber-300 text-amber-700' :
                  'bg-success/10 border-success/20 text-success'
                }`}
              >
                <MonitorSmartphone size={20} className="mb-1" />
                <span className="text-xs font-bold">PC-{term}</span>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600 border-t border-slate-100 pt-4">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-success/20 border border-success/30 inline-block rounded-sm"></span> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-danger/20 border border-danger/30 inline-block rounded-sm"></span> Occupied</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-200 border border-amber-300 inline-block rounded-sm"></span> Maintenance</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Facilities;
