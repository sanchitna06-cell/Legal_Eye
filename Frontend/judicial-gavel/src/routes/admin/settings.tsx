import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle } from "lucide-react";
import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui";
import { useAdminSettings, updateAdminSetting, resetAdminSettings, type AdminSettings } from "@/lib/admin-settings";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Legal Eye Admin" },
      {
        name: "description",
        content: "Console preferences: alert routing, session policy, audit retention and maintenance mode.",
      },
    ],
  }),
});

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-white">{label}</p>
        <p className="text-[11px] text-[#8ea3bb]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-[#1a2737] transition-colors ${value ? "bg-[#38bdf8]" : "bg-[#2a3f5e]"}`}
      >
        <span
          className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? "translateX(14px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

function SettingsPage() {
  const settings = useAdminSettings();
  const [saved, setSaved] = React.useState<string | null>(null);
  const [confirmMaintenance, setConfirmMaintenance] = React.useState(false);

  function set<K extends keyof AdminSettings>(key: K, value: AdminSettings[K], note: string) {
    updateAdminSetting(key, value);
    setSaved(note);
    setTimeout(() => setSaved(null), 3000);
  }

  return (
    <AdminPage
      kicker="LEGAL EYE · ADMIN CONSOLE"
      title="Settings"
      description="Console preferences persist locally in this prototype. In production these map to server-side platform configuration."
    >
      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle className="h-3.5 w-3.5" /> {saved}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminCard title="Alerts" subtitle="Who gets notified, and when">
          <div className="space-y-3 p-4">
            <ToggleRow
              label="Email alerts"
              description="Send email for failed logins and lockouts."
              value={settings.emailAlerts}
              onChange={(v) => set("emailAlerts", v, "Email alerts updated.")}
            />
            <ToggleRow
              label="Security event alerts"
              description="Notify on every DENIED or BLOCKED event."
              value={settings.securityAlerts}
              onChange={(v) => set("securityAlerts", v, "Security alert routing updated.")}
            />
            <ToggleRow
              label="Weekly integrity report"
              description="Monday digest of verification sweeps and audit summary."
              value={settings.weeklyReport}
              onChange={(v) => set("weeklyReport", v, "Weekly report preference updated.")}
            />
          </div>
        </AdminCard>

        <AdminCard title="Session & Retention" subtitle="Applies to every console account">
          <div className="space-y-4 p-4">
            <div className="rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="session-timeout" className="text-sm text-white">Session timeout</label>
                <span className="text-xs tabular-nums text-[#38bdf8]">{settings.sessionTimeoutMinutes} min</span>
              </div>
              <input
                id="session-timeout"
                type="range"
                min={5}
                max={120}
                step={5}
                value={settings.sessionTimeoutMinutes}
                onChange={(e) => set("sessionTimeoutMinutes", Number(e.target.value), "Session timeout updated.")}
                className="mt-2 w-full accent-[#38bdf8]"
              />
            </div>
            <div className="rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="audit-retention" className="text-sm text-white">Audit log retention</label>
                <span className="text-xs tabular-nums text-[#38bdf8]">{settings.auditRetentionDays} days</span>
              </div>
              <input
                id="audit-retention"
                type="range"
                min={90}
                max={1825}
                step={30}
                value={settings.auditRetentionDays}
                onChange={(e) => set("auditRetentionDays", Number(e.target.value), "Audit retention updated.")}
                className="mt-2 w-full accent-[#38bdf8]"
              />
            </div>
            <ToggleRow
              label="Maintenance mode"
              description="Block non-admin sign-ins during platform updates."
              value={settings.maintenanceMode}
              onChange={(v) => {
                if (!v) {
                  set("maintenanceMode", false, "Maintenance mode disabled.");
                  setConfirmMaintenance(false);
                  return;
                }
                setConfirmMaintenance(true);
              }}
            />
          </div>
        </AdminCard>
      </div>

      <AdminCard title="Danger Zone" subtitle="Prototype-only controls" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="max-w-lg text-xs leading-relaxed text-[#8ea3bb]">
            Restore every console preference to its default value. Users you created are kept — manage those in
            User Management.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-red-500/40 text-red-300 hover:bg-red-500/10"
            onClick={() => {
              resetAdminSettings();
              setSaved("Settings restored to defaults.");
              setTimeout(() => setSaved(null), 3000);
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </AdminCard>

      {confirmMaintenance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#1a2737] bg-[#0b131e] p-5 shadow-2xl">
            <h4 className="font-display text-lg text-white">Enable maintenance mode?</h4>
            <p className="mt-2 text-sm leading-relaxed text-[#8ea3bb]">
              Lawyers and analysts will be locked out of sign-in until maintenance mode is switched off.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-[#1a2737] text-[#8ea3bb] hover:text-white"
                onClick={() => setConfirmMaintenance(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-amber-400 text-[#0b131e] hover:bg-amber-300"
                onClick={() => {
                  setConfirmMaintenance(false);
                  set("maintenanceMode", true, "Maintenance mode enabled.");
                }}
              >
                Enable
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
