import { FileText, ExternalLink } from 'lucide-react';

const GeneralEResources = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Public E-Resources</h1>
      <p className="text-slate-600">Access open-access journals and public domain e-books.</p>
      
      <div className="flex gap-4 mb-6">
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium">All Public Resources</button>
        <button className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-medium hover:bg-slate-200">Open Access Journals</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
              <FileText size={24} />
            </div>
            <span className="text-xs font-bold bg-success/10 text-success px-2 py-1 rounded-full uppercase tracking-wider">
              Open Access
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1">History of Local Architecture</h3>
          <p className="text-sm text-slate-500 mb-4 flex-1">Public archive document outlining the historical development of the campus.</p>
          <div className="mt-auto pt-4 border-t border-slate-100">
            <button className="w-full bg-indigo-50 text-indigo-700 font-medium py-2 rounded-lg hover:bg-indigo-100 flex justify-center items-center gap-2">
              <ExternalLink size={16} /> Read Publicly
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralEResources;
