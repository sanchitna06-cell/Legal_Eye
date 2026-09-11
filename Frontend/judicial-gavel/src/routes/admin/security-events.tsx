import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { Badge } from "@/components/ui";
import { SECURITY_EVENTS_FEED, ACTIVITY_COLORS, type SecurityEventFeedItem } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/security-events")({
  component: SecurityEventsPage,
  head: () => ({
    meta: [
      { title: "Security Events — Legal Eye Admin" },
      {
        name: "description",
        content: "Live security feed: denied access attempts, blocked tokens, and confirmed threats.",
      },
    ],
  }),
});

const SEVERITY_STYLES: Record<SecurityEventFeedItem["severity"], string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-emerald-400",
};

function SecurityEventsPage() {
  const [filter, setFilter] = useState<"all" | SecurityEventFeedItem["type"]>("all");

  const filtered = useMemo(
    () => (filter === "all" ? SECURITY_EVENTS_FEED : SECURITY_EVENTS_FEED.filter((e) => e.type === filter)),
    [filter],
  );

  const stats = useMemo(
    () => ({
      total: SECURITY_EVENTS_FEED.length,
      high: SECURITY_EVENTS_FEED.filter((e) => e.severity === "high").length,
      blocked: SECURITY_EVENTS_FEED.filter((e) => e.type === "blocked").length,
    }),
    [],
  );

  return (
    <AdminPage
      kicker="LEGAL EYE · ADMIN CONSOLE"
      title="Security Events"
      description="Live feed of denied access attempts, blocked requests, and confirmed security actions across the platform."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-[#38bdf8]" />
            <div>
              <p className="text-2xl font-semibold text-white">{stats.total}</p>
              <p className="text-[10px] uppercase tracking-widest text-[#8ea3bb]">Events (24h)</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-2xl font-semibold text-white">{stats.high}</p>
              <p className="text-[10px] uppercase tracking-widest text-[#8ea3bb]">High Severity</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-2xl font-semibold text-white">{stats.blocked}</p>
              <p className="text-[10px] uppercase tracking-widest text-[#8ea3bb]">Requests Blocked</p>
            </div>
          </div>
        </div>
      </div>

      <AdminCard title="Event Feed" subtitle="Newest first">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2737] px-4 py-3">
          {(["all", "denied", "blocked", "success"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                filter === value
                  ? "border-[#38bdf8] bg-[#38bdf8]/10 text-[#38bdf8]"
                  : "border-[#1a2737] text-[#8ea3bb] hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="space-y-2 p-3">
          {filtered.map((event) => {
            const Icon = event.type === "success" ? CheckCircle : AlertTriangle;
            return (
              <div key={event.id} className="flex flex-col gap-1.5 rounded-lg border border-[#1a2737] bg-[#0a1320] px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-white/80" />
                    <span className="text-sm text-white">{event.title}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider ${SEVERITY_STYLES[event.severity]}`}>
                      {event.severity}
                    </span>
                    <Badge
                      variant={event.type === "success" ? "default" : event.type === "blocked" ? "destructive" : "secondary"}
                      className="cursor-default text-[10px] uppercase tracking-wider"
                    >
                      {event.badge}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-[#8ea3bb]">{event.detail}</p>
                <p className="text-[10px] tabular-nums text-[#5f7891]">
                  Today, {event.time} · feed colour {ACTIVITY_COLORS.security}
                </p>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-[#8ea3bb]">No events of this type in the window.</p>
          )}
        </div>
      </AdminCard>
    </AdminPage>
  );
}
