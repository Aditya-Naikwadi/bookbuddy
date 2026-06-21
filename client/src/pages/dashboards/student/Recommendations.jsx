import { Sparkles } from 'lucide-react';

const Recommendations = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
          <Sparkles size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">For You</h1>
          <p className="text-slate-600">Smart recommendations based on your recent borrowing history.</p>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Because you read "Clean Code"</h2>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {/* Mock Recommended Book */}
          <div className="w-48 shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
            <div className="h-64 bg-slate-200 w-full"></div>
            <div className="p-3">
              <h3 className="font-bold text-slate-900 line-clamp-2 text-sm mb-1">Refactoring: Improving the Design of Existing Code</h3>
              <p className="text-xs text-slate-500">Martin Fowler</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recommendations;
