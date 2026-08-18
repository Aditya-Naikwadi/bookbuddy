import { useState, useEffect } from "react";
import axios from "axios";
import { Bell, Mail, Smartphone, ShieldCheck, Check } from "lucide-react";

export default function NotificationPreferences() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await axios.get("/api/v1/notification-preferences/me");
        if (res.data.data) {
          setEmailEnabled(res.data.data.emailEnabled ?? true);
          setPushEnabled(res.data.data.pushEnabled ?? true);
          setInAppEnabled(res.data.data.inAppEnabled ?? true);
        }
      } catch (err) {
        console.error("Failed to load notification preferences:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPrefs();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMsg("");

    try {
      await axios.patch("/api/v1/notification-preferences/me", {
        emailEnabled,
        pushEnabled,
        inAppEnabled,
      });
      setSaveSuccessMsg("Preferences saved successfully!");
      setTimeout(() => setSaveSuccessMsg(""), 3000);
    } catch {
      alert("Failed to update preferences.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
      <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-700 pb-4">
        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Notification Channels & Delivery
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage how you receive library reminders and announcements.
          </p>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs rounded-lg flex items-center">
          <Check className="w-4 h-4 mr-1.5" /> {saveSuccessMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-slate-500" />
              <div>
                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Email Reminders
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receive due date reminders & reservation alerts via email.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center space-x-3">
              <Smartphone className="w-5 h-5 text-slate-500" />
              <div>
                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Push Notifications
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receive instant browser & mobile push alerts.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={(e) => setPushEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-slate-500" />
              <div>
                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  In-App Alerts
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Display notification popups inside the web application.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={inAppEnabled}
              onChange={(e) => setInAppEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs flex items-start space-x-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>Mandatory Safety Exemption:</strong> Critical final overdue
            notices and fine warnings will always be delivered regardless of
            custom channel preferences to protect patron library standing.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}
