import { Mail as MailIcon, HardDrive, RefreshCw } from 'lucide-react';

const SystemSettings = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-serif font-bold text-slate-900">Infrastructure Settings</h1>
      <p className="text-slate-600">Configure global database backups, email servers, and core parameters.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Backups */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <HardDrive className="text-indigo-600" />
            <h2 className="text-xl font-bold">Database & Backups</h2>
          </div>
          
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mb-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-slate-900">Automated Daily Backups</p>
              <p className="text-xs text-slate-500 mt-1">Runs every day at 03:00 AM UTC</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
            </label>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-700">Recent Snapshots</h3>
            <div className="flex justify-between items-center p-3 border border-slate-100 rounded-lg text-sm">
              <span className="font-mono text-slate-600">backup-2026-10-24.tar.gz (1.2GB)</span>
              <button className="text-indigo-600 hover:underline font-medium">Download</button>
            </div>
            <div className="flex justify-between items-center p-3 border border-slate-100 rounded-lg text-sm">
              <span className="font-mono text-slate-600">backup-2026-10-23.tar.gz (1.1GB)</span>
              <button className="text-indigo-600 hover:underline font-medium">Download</button>
            </div>
          </div>
          
          <button className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium py-2 rounded-lg hover:bg-indigo-100">
            <RefreshCw size={16} /> Force Manual Backup Now
          </button>
        </div>

        {/* Global SMTP Configuration */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <MailIcon className="text-indigo-600" />
            <h2 className="text-xl font-bold">Global SMTP Email Configuration</h2>
          </div>
          
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SMTP Host</label>
              <input type="text" defaultValue="smtp.sendgrid.net" className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                <input type="number" defaultValue={587} className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Security</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50">
                  <option>TLS</option>
                  <option>SSL</option>
                  <option>None</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">API Key / Password</label>
              <input type="password" defaultValue="*********" className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50" />
            </div>
            <button type="button" className="w-full bg-slate-900 text-white font-medium py-2 rounded-lg hover:bg-slate-800 mt-4">
              Save SMTP Configuration
            </button>
            <p className="text-xs text-center text-slate-500 mt-2">Used by all College Admins for fine notifications and dues.</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
