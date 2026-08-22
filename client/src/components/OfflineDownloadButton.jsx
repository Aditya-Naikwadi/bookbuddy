import { useState, useEffect } from 'react';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HardDriveDownload,
  Trash2,
} from 'lucide-react';
import {
  downloadEResource,
  isResourceDownloaded,
  deleteOfflineResource,
} from '../lib/downloadManager';

export const OfflineDownloadButton = ({ resourceId, isDownloadable = true }) => {
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      if (!resourceId) return;
      const isDL = await isResourceDownloaded(resourceId);
      if (isMounted) setDownloaded(isDL);
    };
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [resourceId]);

  const handleDownload = async () => {
    if (!isDownloadable) {
      setErrorMsg('This e-resource has not been enabled for offline download by the administrator.');
      return;
    }

    try {
      setErrorMsg(null);
      setDownloading(true);
      setProgress(0);

      await downloadEResource(resourceId, (percentage) => {
        setProgress(percentage);
      });

      setDownloaded(true);
    } catch (err) {
      console.error('Offline download failed:', err);
      setErrorMsg(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteOfflineResource(resourceId);
      setDownloaded(false);
      setProgress(0);
    } catch (err) {
      console.error('Failed to remove offline copy:', err);
    }
  };

  if (!isDownloadable) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-400 text-xs font-medium cursor-not-allowed">
        <Download className="w-3.5 h-3.5 text-slate-500" />
        <span>Offline Download Unavailable</span>
      </div>
    );
  }

  if (downloaded) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Available Offline</span>
        </div>
        <button
          onClick={handleDelete}
          title="Remove offline download"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors border border-slate-700"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Error / Quota Warning Banner */}
      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 max-w-sm animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Download Action / Progress Bar */}
      {downloading ? (
        <div className="flex flex-col gap-1.5 min-w-[200px] bg-slate-900 border border-indigo-500/40 rounded-xl p-2.5 shadow-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              Downloading for offline...
            </span>
            <span>{progress}%</span>
          </div>
          {/* Progress Track */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md hover:shadow-indigo-500/20 active:scale-95 border border-indigo-400/30"
        >
          <HardDriveDownload className="w-4 h-4" />
          <span>Download for Offline Reading</span>
        </button>
      )}
    </div>
  );
};

export default OfflineDownloadButton;
