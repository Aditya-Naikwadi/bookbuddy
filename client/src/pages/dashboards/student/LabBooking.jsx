import { Monitor, Calendar, Clock } from 'lucide-react';

const LabBooking = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Computer Lab Booking</h1>
      <p className="text-slate-600">Reserve a workstation in the library's digital research lab.</p>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input type="date" className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Time Slot</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <select className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option>09:00 AM - 11:00 AM</option>
                  <option>11:00 AM - 01:00 PM</option>
                  <option>02:00 PM - 04:00 PM</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex-[2] bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h3 className="text-center font-medium text-slate-700 mb-4">Select a Workstation</h3>
            <div className="grid grid-cols-4 gap-4">
              {/* Mock Seats */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map(seat => (
                <button 
                  key={seat}
                  className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center transition-colors ${
                    seat === 3 ? 'bg-danger/10 border-danger/20 text-danger cursor-not-allowed' :
                    seat === 5 ? 'bg-indigo-100 border-indigo-500 text-indigo-700' :
                    'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  <Monitor size={24} className="mb-2" />
                  <span className="font-bold text-sm">PC-{seat}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button className="bg-indigo-600 text-white px-8 py-2 rounded-lg font-medium hover:bg-indigo-700 w-full md:w-auto">
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabBooking;
