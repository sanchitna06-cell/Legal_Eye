import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { Button, Input } from "@/components/ui";
import { AUDIT_LOGS, type AuditLogEntry } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/audit-logs")({
  component: AuditLogsPage,
  head: () => ({
    meta: [
      { title: "Audit Logs — Legal Eye Admin" },
      {
        name: "description",
        content: "Complete audit trail of every action taken in the Legal Eye console.",
      },
    ],
  }),
});

const RESULT_STYLES: Record<AuditLogEntry["result"], string> = {
  success: "text-emerald-400",
  failure: "text-red-400",
  warning: "text-amber-400",
};

function AuditLogsPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<"all" | AuditLogEntry["result"]>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AUDIT_LOGS.filter((log) => {
      if (result !== "all" && log.result !== result) return false;
      if (q && !`${log.actor} ${log.action} ${log.target} ${log.ip}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, result]);

  const stats = useMemo(
    () => ({
      total: AUDIT_LOGS.length,
      failures: AUDIT_LOGS.filter((l) => l.result === "failure").length,
      warnings: AUDIT_LOGS.filter((l) => l.result === "warning").length,
    }),
    [],
  );

  return (
    <AdminPage
      kicker="LEGAL EYE · ADMIN CONSOLE"
      title="Audit Logs"
      description="Immutable trail of every sign-in, document action, and administrative change. Entries are append-only and retained for one year."
      actions={
        <Button variant="outline" size="sm" className="border-[#1a2737] text-[#8ea3bb] hover:text-white">
          <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
        </Button>
      }
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Entries (recent window)" value={String(stats.total)} />
        <StatTile label="Failures" value={String(stats.failures)} tone="text-red-400" />
        <StatTile label="Warnings" value={String(stats.warnings)} tone="text-amber-400" />
      </div>

      <AdminCard title="Audit Trail" subtitle="Newest first · append-only">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#1a2737] px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Input
              type="search"
              placeholder="Search actor, action, target or IP..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-[#1a2737] bg-[#0a1320] text-sm text-white placeholder:text-[#5f7891] focus-visible:ring-[#38bdf8]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "success", "failure", "warning"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setResult(value)}
                className={`rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                  result === value
                    ? "border-[#38bdf8] bg-[#38bdf8]/10 text-[#38bdf8]"
                    : "border-[#1a2737] text-[#8ea3bb] hover:text-white"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1a2737] bg-[#0a1320]">
                {["Timestamp", "Actor", "Action", "Target", "Result", "Source IP"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-3 py-3 text-[10px] uppercase tracking-widest text-[#8ea3bb] ${i === 5 ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-b border-[#1a2737] last:border-0">
                  <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-[#8ea3bb]">{log.timestamp}</td>
                  <td className="px-3 py-3 font-mono text-xs text-white">{log.actor}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[#38bdf8]">{log.action}</td>
                  <td className="px-3 py-3 text-xs text-[#a3b6cd]">{log.target}</td>
                  <td className={`px-3 py-3 text-xs font-medium capitalize ${RESULT_STYLES[log.result]}`}>{log.result}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-[#8ea3bb]">{log.ip}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-[#8ea3bb]">
                    No audit entries match the current filters.
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

function StatTile({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[#8ea3bb]">{label}</p>
    </div>
  );
}
