import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { SYSTEM_HEALTH } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/system-health")({
  component: SystemHealthPage,
  head: () => ({
    meta: [
      { title: "System Health — Legal Eye Admin" },
      {
        name: "description",
        content: "Per-service latency, uptime and availability for every Legal Eye component.",
      },
    ],
  }),
});

/** Deterministic pseudo-uptime so the demo bars look real but stable across renders. */
function uptimeFor(service: string): { hours: boolean[]; pct: number } {
  let hash = 0;
  for (let i = 0; i < service.length; i++) hash = (hash * 31 + service.charCodeAt(i)) % 997;
  const hours: boolean[] = [];
  for (let i = 0; i < 24; i++) {
    hours.push(((hash + i * 7) % 23) !== 0); // ~1 degraded hour per service per day
  }
  const up = hours.filter(Boolean).length;
  return { hours, pct: Math.round((up / 24) * 1000) / 10 };
}

function SystemHealthPage() {
  const avgLatency = useMemo(() => {
    const nums = SYSTEM_HEALTH.map((s) => parseInt(s.latency, 10)).filter((n) => !Number.isNaN(n));
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  }, []);

  const avgUptime = useMemo(() => {
    const pcts = SYSTEM_HEALTH.map((s) => uptimeFor(s.name).pct);
    return Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10;
  }, []);

  return (
    <AdminPage
      kicker="LEGAL EYE · ADMIN CONSOLE"
      title="System Health"
      description="Live operational status of every Legal Eye service — latency, 24-hour uptime, and incident notes."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-2xl font-semibold text-white">{SYSTEM_HEALTH.length}</p>
              <p className="text-[10px] uppercase tracking-widest text-[#8ea3bb]">Services Monitored</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <p className="text-2xl font-semibold text-white">{avgLatency} ms</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[#8ea3bb]">Average Latency</p>
        </div>
        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <p className="text-2xl font-semibold text-emerald-400">{avgUptime}%</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[#8ea3bb]">24h Availability</p>
        </div>
      </div>

      <AdminCard title="Service Status" subtitle="Per-service latency and 24-hour uptime">
        <div className="divide-y divide-[#1a2737]">
          {SYSTEM_HEALTH.map((service) => {
            const { hours, pct } = uptimeFor(service.name);
            return (
              <div key={service.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex min-w-[180px] flex-1 items-center gap-2">
                  <span
                    className="flex h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: service.healthy ? "#34d399" : "#f87171" }}
                  />
                  <span className="text-sm text-white">{service.name}</span>
                </div>

                <div className="flex items-end gap-[2px]" aria-label={`Uptime ${pct}%`}>
                  {hours.map((up, i) => (
                    <span
                      key={i}
                      className={`h-4 w-[3px] rounded-sm ${up ? "bg-emerald-400/80" : "bg-amber-400"}`}
                      title={`${i}:00 — ${up ? "operational" : "degraded"}`}
                    />
                  ))}
                </div>

                <span className="w-16 text-right text-xs tabular-nums text-[#8ea3bb]">{service.latency}</span>
                <span className="w-14 text-right text-xs tabular-nums text-emerald-400">{pct}%</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1a2737] px-4 py-2">
          <p className="text-[10px] text-[#5f7891]">
            Amber bars mark degraded minutes in the last 24 hours.
          </p>
          <p className="text-[10px] text-[#5f7891]">All times IST · checks every 60s</p>
        </div>
      </AdminCard>
    </AdminPage>
  );
}
