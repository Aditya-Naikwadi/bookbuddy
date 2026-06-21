import { UploadCloud, FolderLock, FileType } from 'lucide-react';

const DigitalAssets = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Digital Asset Management</h1>
      <p className="text-slate-600">Upload and manage proprietary college resources, exam papers, and e-books.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Portal */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <UploadCloud className="text-indigo-600" />
            <h2 className="text-xl font-bold">Upload Resource</h2>
          </div>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center mb-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
            <UploadCloud size={40} className="text-slate-400 mb-3" />
            <p className="font-medium text-slate-700 mb-1">Drag and drop files here</p>
            <p className="text-xs text-slate-500">PDF, EPUB, or ZIP up to 50MB</p>
          </div>
          <form className="space-y-4">
            <input type="text" placeholder="Document Title" className="w-full p-2 border border-slate-300 rounded-lg" />
            <select className="w-full p-2 border border-slate-300 rounded-lg">
              <option>Past Exam Papers</option>
              <option>Research Journals</option>
              <option>Faculty Publications</option>
            </select>
            <button type="button" className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700">
              Publish to E-Resources
            </button>
          </form>
        </div>

        {/* DAM Repository */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderLock className="text-indigo-600" />
              <h2 className="text-xl font-bold">Secure Repository</h2>
            </div>
            <input type="text" placeholder="Search assets..." className="p-2 border border-slate-300 rounded-lg text-sm w-64" />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-900">
                <tr>
                  <th className="p-3 font-semibold rounded-tl-lg">Type</th>
                  <th className="p-3 font-semibold">Title</th>
                  <th className="p-3 font-semibold">Category</th>
                  <th className="p-3 font-semibold">Size</th>
                  <th className="p-3 font-semibold rounded-tr-lg">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3"><FileType className="text-danger" size={20} /></td>
                  <td className="p-3 font-medium text-slate-900">CS101 Final 2025</td>
                  <td className="p-3">Past Exam Papers</td>
                  <td className="p-3">2.4 MB</td>
                  <td className="p-3">
                    <button className="text-slate-500 hover:text-danger mr-3">Delete</button>
                    <button className="text-indigo-600 hover:underline">Edit</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalAssets;
