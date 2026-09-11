import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, RefreshCw } from "lucide-react";
import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui";
import { EVENT_PIPELINE, SYSTEM_HEALTH, type PipelineEvent } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/event-pipeline")({
  component: EventPipelinePage,
  head: () => ({
    meta: [
      { title: "Event Pipeline — Legal Eye Admin" },
      {
        name: "description",
        content: "Trace how auth, upload, blockchain and audit events flow between Legal Eye services.",
      },
    ],
  }),
});

const STATUS_STYLES: Record<PipelineEvent["status"], string> = {
  delivered: "text-emerald-400",
  processing: "text-sky-400",
  queued: "text-amber-400",
  failed: "text-red-400",
};

function EventPipelinePage() {
  const [statusFilter, setStatusFilter] = useState<"all" | PipelineEvent["status"]>("all");
  const [pulse, setPulse] = useState(0);

  const filtered = useMemo(
    () => (statusFilter === "all" ? EVENT_PIPELINE : EVENT_PIPELINE.filter((e) => e.status === statusFilter)),
    [statusFilter],
  );

  const stats = useMemo(() => {
    const byStatus = (s: PipelineEvent["status"]) => EVENT_PIPELINE.filter((e) => e.status === s).length;
    return { delivered: byStatus("delivered"), queued: byStatus("queued") + byStatus("processing"), failed: byStatus("failed") };
  }, []);

  const stages = SYSTEM_HEALTH.slice(0, 5).map((s) => s.name);

  return (
    <AdminPage
      kicker="LEGAL EYE · ADMIN CONSOLE"
      title="Event Pipeline"
      description="How auth, upload, blockchain and audit events travel between services — with queue depths and delivery status."
      actions={
        <Button variant="outline" size="sm" className="border-[#1a2737] text-[#8ea3bb] hover:text-white" onClick={() => setPulse((p) => p + 1)}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Delivered (24h)" value={String(stats.delivered)} tone="text-emerald-400" />
        <Stat label="Queued / Processing" value={String(stats.queued)} tone="text-amber-400" />
        <Stat label="Failed" value={String(stats.failed)} tone="text-red-400" />
      </div>

      <AdminCard title="Flow Overview" subtitle="Publishers → bus → consumers" className="mb-6">
        <div className="flex flex-wrap items-center gap-2 p-4">
          {["Auth Service", "Upload Service", "API Gateway"].map((pub) => (
            <span key={pub} className="flex items-center gap-2">
              <span className="rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2 text-xs text-white">{pub}</span>
              <ArrowRight className="h-4 w-4 text-[#38bdf8]" />
            </span>
          ))}
          <span className="rounded-md border border-[#38bdf8]/40 bg-[#38bdf8]/10 px-3 py-2 text-xs text-[#38bdf8]">
            Event Bus
          </span>
          <ArrowRight className="h-4 w-4 text-[#38bdf8]" />
          <span className="flex flex-wrap items-center gap-2">
            {stages.map((stage) => (
              <span key={stage} className="rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2 text-xs text-[#a3b6cd]">
                {stage}
              </span>
            ))}
          </span>
        </div>
      </AdminCard>

      <AdminCard title="Event Stream" subtitle={pulse > 0 ? `Refreshed ${pulse}×` : "Latest 10 deliveries"}>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2737] px-4 py-3">
          {(["all", "delivered", "processing", "queued", "failed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-widest capitalize transition-colors ${
                statusFilter === value
                  ? "border-[#38bdf8] bg-[#38bdf8]/10 text-[#38bdf8]"
                  : "border-[#1a2737] text-[#8ea3bb] hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1a2737] bg-[#0a1320]">
                {["Time", "Service", "Event", "Status", "Latency"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-[#1a2737] last:border-0">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums text-[#8ea3bb]">{e.time}</td>
                  <td className="px-3 py-3 text-xs text-white">{e.service}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[#a3b6cd]">{e.event}</td>
                  <td className={`px-3 py-3 text-xs font-medium capitalize ${STATUS_STYLES[e.status]}`}>{e.status}</td>
                  <td className="px-3 py-3 font-mono text-xs tabular-nums text-[#8ea3bb]">{e.latency}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-[#8ea3bb]">
                    No events with this status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPage>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[#8ea3bb]">{label}</p>
    </div>
  );
}
