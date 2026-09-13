import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Shield,
  FileCheck2,
  Link2,
  ClipboardCheck,
} from "lucide-react";

import {
  getAdminSecurityControls,
  type AdminSecurityControl,
  type AdminSecurityControls,
} from "@/lib/api";

import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { Badge, Button } from "@/components/ui";


export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Security Controls — Jury Hash Admin" },
      {
        name: "description",
        content:
          "Security controls and protections currently enforced by the Jury Hash backend.",
      },
    ],
  }),
});

function capitalizeStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getControlIcon(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes("jwt")) {
    return LockKeyhole;
  }

  if (normalized.includes("rbac")) {
    return Shield;
  }

  if (normalized.includes("active user")) {
    return ShieldCheck;
  }

  if (normalized.includes("password")) {
    return LockKeyhole;
  }

  if (normalized.includes("audit")) {
    return ClipboardCheck;
  }

  if (normalized.includes("document integrity")) {
    return FileCheck2;
  }

  if (normalized.includes("hash chain")) {
    return Link2;
  }

  return ShieldCheck;
}


function isActive(status: string) {
  return status.toLowerCase() === "active";
}


function SecurityControlRow({
  control,
}: {
  control: AdminSecurityControl;
}) {
  const Icon = getControlIcon(control.name);
  const active = isActive(control.status);

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[#1a2737] bg-[#0a1320] px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
            active
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <Icon
            className={`h-4 w-4 ${
              active ? "text-emerald-400" : "text-amber-400"
            }`}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-white">
            {control.name}
          </p>

          <p className="mt-1 text-xs leading-relaxed text-[#8ea3bb]">
            {control.description}
          </p>
        </div>
      </div>

      <Badge
        variant={active ? "default" : "secondary"}
        className={
          active
            ? "shrink-0 cursor-default border-emerald-500/40 bg-emerald-500/15 text-[10px] uppercase tracking-wider text-emerald-100"
            : "shrink-0 cursor-default text-[10px] uppercase tracking-wider text-amber-300"
        }
      >
        {control.status}
      </Badge>
    </div>
  );
}


function SettingsPage() {
  const [security, setSecurity] =
    React.useState<AdminSecurityControls | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadSecurityControls = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getAdminSecurityControls();
      setSecurity(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load security controls.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSecurityControls();
  }, [loadSecurityControls]);


  if (loading) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="Security Controls"
        description="Security controls currently enforced by the Jury Hash backend."
      >
        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] px-4 py-10 text-center text-sm text-[#8ea3bb]">
          Loading security controls…
        </div>
      </AdminPage>
    );
  }


  if (error || !security) {
    return (
      <AdminPage
        kicker="JURY HASH · ADMIN CONSOLE"
        title="Security Controls"
        description="Security controls currently enforced by the Jury Hash backend."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSecurityControls()}
            className="border-[#1a2737] text-[#8ea3bb] hover:text-white"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        }
      >
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-300">
          {error ?? "Security controls are unavailable."}
        </div>
      </AdminPage>
    );
  }


  const activeControls = security.controls.filter((control) =>
    isActive(control.status),
  ).length;

  const totalControls = security.controls.length;


  return (
    <AdminPage
      kicker="JURY HASH · ADMIN CONSOLE"
      title="Security Controls"
      description="Security controls currently enforced by the Jury Hash backend."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadSecurityControls()}
          disabled={loading}
          className="border-[#1a2737] text-[#8ea3bb] hover:text-white"
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh
        </Button>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>

            <div>
              <p className="text-lg font-semibold text-emerald-400">
                {capitalizeStatus(security.overall_status)}
              </p>

              <p className="mt-1 text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                Overall Security Status
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />

            <div>
              <p className="text-2xl font-semibold text-white">
                {activeControls}
              </p>

              <p className="mt-1 text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                Active Controls
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-[#38bdf8]" />

            <div>
              <p className="text-2xl font-semibold text-white">
                {totalControls}
              </p>

              <p className="mt-1 text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                Controls Reported
              </p>
            </div>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminCard
          title="Security Controls"
          subtitle="Backend-enforced protections"
        >
          <div className="space-y-2 p-4">
            {security.controls.map((control) => (
              <SecurityControlRow
                key={control.name}
                control={control}
              />
            ))}
          </div>
        </AdminCard>


        <AdminCard
          title="Security Posture"
          subtitle="Current backend configuration status"
        >
          <div className="space-y-3 p-4">
            <div className="rounded-lg border border-[#1a2737] bg-[#0a1320] p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />

                <div>
                  <p className="text-sm font-medium text-white">
                    {capitalizeStatus(security.overall_status)}
                  </p>

                  <p className="mt-1 text-xs text-[#8ea3bb]">
                    Overall security status reported by the backend.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#1a2737] bg-[#0a1320] p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#5f7891]">
                Coverage
              </p>

              <p className="mt-1 text-sm text-white">
                {activeControls} of {totalControls} reported controls are
                active.
              </p>
            </div>

            <div className="rounded-lg border border-[#1a2737] bg-[#0a1320] p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#5f7891]">
                Source
              </p>

              <p className="mt-1 text-xs leading-relaxed text-[#8ea3bb]">
                This page reflects the security controls currently reported
                by the Jury Hash backend. It does not modify server-side
                security configuration.
              </p>
            </div>
          </div>
        </AdminCard>
      </div>


      <div className="mt-6 rounded-lg border border-[#1a2737] bg-[#0a1320] px-4 py-3">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#38bdf8]" />

          <div>
            <p className="text-xs font-medium text-white">
              Read-only security configuration
            </p>

            <p className="mt-1 text-[11px] leading-relaxed text-[#8ea3bb]">
              Security policies are enforced by the backend. This console
              reports their current state rather than storing preferences in
              browser localStorage.
            </p>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}