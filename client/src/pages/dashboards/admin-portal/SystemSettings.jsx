import { useState, useEffect } from "react";
import {
  Mail as MailIcon,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import OpsHeader from "../../../components/ops/OpsHeader";

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    smtpHost: "smtp.sendgrid.net",
    smtpPort: 587,
    smtpSecurity: "TLS",
    smtpUser: "apikey",
    autoBackupEnabled: true,
    autoBackupSchedule: "Daily at 03:00 AM UTC",
    maintenanceMode: false,
  });

  const [_isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [latestBackup, setLatestBackup] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        setIsLoading(true);
        const data = await adminApi.getSystemSettings();
        if (isMounted && data) {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    try {
      await adminApi.updateSystemSettings(settings);
      setMessage({
        type: "success",
        text: "Global system configuration updated and persisted.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.response?.data?.message || "Failed to update system settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await adminApi.triggerManualBackup();
      setLatestBackup(res.filename);
      setMessage({
        type: "success",
        text: `Manual database snapshot generated: ${res.filename}`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to trigger backup.",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      <OpsHeader
        title="System Configuration & Backups"
        subtitle="Manage SMTP email parameters, automated database backup schedules, and maintenance mode flags"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Notification Banner */}
        {message.text && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-xs ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage({ type: "", text: "" })}
              className="font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Database & Backups Panel */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Database Snapshots & Maintenance
                </h2>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-slate-900">
                  Automated Daily Backups
                </p>
                <p className="text-slate-500 mt-0.5 font-normal">
                  Schedule: {settings.autoBackupSchedule}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="autoBackupEnabled"
                  checked={settings.autoBackupEnabled}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-amber-900">
                  Global System Maintenance Mode
                </p>
                <p className="text-slate-500 mt-0.5 font-normal">
                  Locks non-super-admin access during platform upgrades
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="maintenanceMode"
                  checked={settings.maintenanceMode}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {latestBackup && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-1">
                <div className="text-xs text-emerald-800 font-semibold">
                  Latest Snapshot Generated
                </div>
                <div className="text-slate-700 font-mono text-[11px]">
                  {latestBackup}
                </div>
              </div>
            )}

            <button
              onClick={handleTriggerBackup}
              disabled={isBackingUp}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isBackingUp ? "animate-spin" : ""}`}
              />
              <span>
                {isBackingUp
                  ? "Generating Snapshot..."
                  : "Generate Manual Database Snapshot"}
              </span>
            </button>
          </div>

          {/* Global SMTP Configuration Panel */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <MailIcon className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Global Email & SMTP Configuration
                </h2>
              </div>
            </div>

            <form
              onSubmit={handleSaveSettings}
              className="space-y-4 text-xs font-medium"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  name="smtpHost"
                  value={settings.smtpHost}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Port *
                  </label>
                  <input
                    type="number"
                    name="smtpPort"
                    value={settings.smtpPort}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Security Protocol
                  </label>
                  <select
                    name="smtpSecurity"
                    value={settings.smtpSecurity}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
                  >
                    <option value="TLS">TLS</option>
                    <option value="SSL">SSL</option>
                    <option value="NONE">NONE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  SMTP Username
                </label>
                <input
                  type="text"
                  name="smtpUser"
                  value={settings.smtpUser}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:border-indigo-500 focus:outline-none shadow-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {isSaving ? "Saving Configuration..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
