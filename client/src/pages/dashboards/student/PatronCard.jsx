import { QrCode, Download } from 'lucide-react';

const PatronCard = () => {
  return (
    <div className="space-y-6 flex flex-col items-center py-10">
      
      <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-indigo-900 rounded-3xl shadow-2xl overflow-hidden text-white relative transition-transform hover:scale-[1.02] duration-300">
        <div className="p-8 relative z-10">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
                <span className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">B</span>
                BookBuddy
              </h2>
              <p className="text-indigo-300 text-sm mt-1 uppercase tracking-wider font-semibold">Student ID</p>
            </div>
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
              <span className="text-xl font-bold">JD</span>
            </div>
          </div>
          
          <div className="space-y-1 mb-10">
            <h3 className="text-3xl font-bold tracking-wide">John Doe</h3>
            <p className="text-indigo-200 font-mono text-lg opacity-80">STU-1001-9042</p>
          </div>
          
          <div className="flex justify-between items-end">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold">Valid Thru</p>
                <p className="font-mono">12/2030</p>
              </div>
              <span className="inline-block bg-success/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold border border-success/30 backdrop-blur-sm">
                Active Member
              </span>
            </div>
            
            <div className="bg-white p-3 rounded-xl shadow-inner">
              <QrCode className="text-slate-900 w-20 h-20" />
            </div>
          </div>
        </div>
        
        {/* Modern decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 opacity-20 rounded-full -ml-20 -mb-20 blur-3xl pointer-events-none"></div>
      </div>
      
      <div className="mt-8 text-center space-y-4">
        <p className="text-slate-500 text-sm max-w-sm">
          Present this digital card at the library desk or use it to scan into the computer lab.
        </p>
        <button className="text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-2 justify-center mx-auto transition-colors">
          <Download size={18} />
          Add to Apple Wallet / Google Pay
        </button>
      </div>
    </div>
  );
};

export default PatronCard;
