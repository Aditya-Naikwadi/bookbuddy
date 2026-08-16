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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <OpsHeader
        title="MODULE 06 // GLOBAL SYSTEM CONFIGURATION & DATABASE BACKUP"
        subtitle="Manage SMTP parameters, automated backup schedules, system maintenance mode, and manual snapshot triggers"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6 font-mono">
        {/* Notification Banner */}
        {message.text && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
              message.type === "success"
                ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                : "bg-rose-950/60 border-rose-700/60 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage({ type: "", text: "" })}
              className="font-bold hover:underline"
            >
              DISMISS
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Database & Backups Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase">
                  Database Snapshot & Maintenance
                </h2>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-200 uppercase">
                  Automated Daily Backups
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
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
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-amber-300 uppercase">
                  Global System Maintenance Mode
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Locks non-super-admin routes during system upgrades
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
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {latestBackup && (
              <div className="bg-emerald-950/40 border border-emerald-700/50 p-3 rounded-lg text-xs space-y-1">
                <div className="text-[10px] text-emerald-400 uppercase font-bold">
                  Latest Snapshot Generated
                </div>
                <div className="text-slate-200 font-mono text-[11px]">
                  {latestBackup}
                </div>
              </div>
            )}

            <button
              onClick={handleTriggerBackup}
              disabled={isBackingUp}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <RefreshCw
                className={`w-4 h-4 ${isBackingUp ? "animate-spin" : ""}`}
              />
              <span>
                {isBackingUp
                  ? "EXECUTING SNAPSHOT DUMP..."
                  : "FORCE MANUAL DATABASE SNAPSHOT"}
              </span>
            </button>
          </div>

          {/* Global SMTP Configuration Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MailIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase">
                  Global SMTP Email Configuration
                </h2>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  name="smtpHost"
                  value={settings.smtpHost}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 mt-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">
                    Port *
                  </label>
                  <input
                    type="number"
                    name="smtpPort"
                    value={settings.smtpPort}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 mt-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">
                    Security *
                  </label>
                  <select
                    name="smtpSecurity"
                    value={settings.smtpSecurity}
                    onChange={handleChange}
                    className="w-full px-3 py-2 mt-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="TLS">TLS</option>
                    <option value="SSL">SSL</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold">
                  API Key / SMTP Username
                </label>
                <input
                  type="text"
                  name="smtpUser"
                  value={settings.smtpUser}
                  onChange={handleChange}
                  className="w-full px-3 py-2 mt-1 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-lg"
              >
                {isSaving ? "SAVING SETTINGS..." : "SAVE GLOBAL CONFIGURATION"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
