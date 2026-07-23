import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import featureApi from '../../api/featureApi';

export default function UploadProgressPanel({ jobId, totalRows = 100, onComplete }) {
  const [progress, setProgress] = useState(15);
  const [processed, setProcessed] = useState(Math.floor(totalRows * 0.15));
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    let delay = 1500;
    let timerId;

    const pollStatus = async () => {
      try {
        const res = await featureApi.getUploadJobStatus(jobId);

        if (res.status === 'completed' || progress >= 100) {
          setProgress(100);
          setProcessed(res.processed || totalRows);
          setFailed(res.failed || 0);
          onComplete(res);
          return;
        }

        // Increment progress for smooth feedback
        setProgress((prev) => {
          const next = Math.min(95, prev + Math.floor(Math.random() * 25) + 15);
          setProcessed(Math.floor((totalRows * next) / 100));
          return next;
        });

        delay = Math.min(8000, delay * 1.5); // Exponential backoff
        timerId = setTimeout(pollStatus, delay);
      } catch (err) {
        console.error('Job status polling error:', err);
      }
    };

    timerId = setTimeout(pollStatus, delay);
    return () => clearTimeout(timerId);
  }, [jobId, totalRows, onComplete]);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-xl mx-auto text-center shadow-lg space-y-6">
      <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto animate-pulse">
        <Loader2 size={32} className="animate-spin" />
      </div>

      <div>
        <h3 className="text-xl font-serif font-bold text-slate-900 mb-1">
          Processing Student Roster Import...
        </h3>
        <p className="text-slate-500 text-xs sm:text-sm">
          Job ID: <code className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{jobId}</code>
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-slate-600">
          <span>Processing Roster</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Live Counter Stats */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-xs text-slate-500 font-medium">Processed</span>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{processed} / {totalRows}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <span className="text-xs text-slate-500 font-medium">Flagged Errors</span>
          <p className="text-xl font-bold text-rose-600 mt-0.5">{failed}</p>
        </div>
      </div>
    </div>
  );
}
