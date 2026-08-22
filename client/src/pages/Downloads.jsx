import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive,
  Trash2,
  BookOpen,
  FileText,
  Clock,
  CheckCircle2,
  Database,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getAllOfflineResources,
  deleteOfflineResource,
  checkStorageQuota,
} from '../lib/downloadManager';

export const Downloads = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState({ totalMB: '0.0', freeMB: '0.0' });
  const navigate = useNavigate();

  const loadOfflineItems = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const offlineList = await getAllOfflineResources();
      setItems(offlineList);

      // Compute storage summary
      const totalBytes = offlineList.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

      const quotaData = await checkStorageQuota(0);
      const freeMB = quotaData.remainingSpace
        ? (quotaData.remainingSpace / (1024 * 1024)).toFixed(0)
        : 'Unknown';

      setStorageInfo({ totalMB, freeMB });
    } catch (err) {
      console.error('Failed to load offline items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Asynchronous offline storage load updates state after IndexedDB fetch
    loadOfflineItems();
  }, []);

  const handleDeleteItem = async (resourceId) => {
    try {
      await deleteOfflineResource(resourceId);
      // Refresh items list and re-compute storage estimate
      await loadOfflineItems();
    } catch (err) {
      console.error('Failed to delete offline resource:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0.0 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 max-w-7xl mx-auto">
      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> DRM-Light Offline Access
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-indigo-400" /> Offline Downloads Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your IndexedDB-stored e-books and papers for reading without network access.
          </p>
        </div>

        {/* Back to Catalog Button */}
        <button
          onClick={() => navigate('/catalog')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white font-medium text-xs transition-colors self-start md:self-auto"
        >
          <span>Explore Catalog</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Storage Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Storage Used */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Offline Storage Used
            </div>
            <div className="text-2xl font-black text-white mt-0.5">{storageInfo.totalMB} MB</div>
          </div>
        </div>

        {/* Total Offline Items */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Downloaded Resources
            </div>
            <div className="text-2xl font-black text-white mt-0.5">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </div>
          </div>
        </div>

        {/* Browser Quota Free Space */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Free Quota Space
            </div>
            <div className="text-2xl font-black text-white mt-0.5">{storageInfo.freeMB} MB</div>
          </div>
        </div>
      </div>

      {/* Offline Resources List */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" /> Downloaded Items ({items.length})
        </h2>

        {loading ? (
          <div className="space-y-4 py-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-800/50 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-slate-800/80 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <HardDrive className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No Offline Downloads</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              You haven't downloaded any e-resources for offline reading yet. Visit the library e-resources page to download books.
            </p>
            <button
              onClick={() => navigate('/eresources')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg transition-all"
            >
              Browse E-Resources
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {items.map((item) => (
              <div
                key={item.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-800/30 px-3 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-indigo-950 border border-indigo-500/30 text-indigo-300">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
                        {item.mimeType?.includes('epub') ? 'EPUB' : 'PDF'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(item.downloadedAt).toLocaleDateString()}
                      </span>
                      <span className="font-semibold text-indigo-300">
                        {formatFileSize(item.sizeBytes)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(`/reader/${item.id}`)}
                    className="px-4 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Read Offline</span>
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    title="Delete offline download"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors border border-slate-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Downloads;
