import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  Users,
  FolderKanban,
  Shield,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle,
  Copy,
  Plus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  METRICS,
  ACTIVITY_24H,
  ACTIVITY_COLORS,
  RECENT_SECURITY_EVENTS,
  SYSTEM_HEALTH,
  USER_MANAGEMENT,
  SAMPLE_DOCUMENT,
  type MetricCard,
  type SecurityEvent,
  type HealthService,
  type UserRow,
} from "@/lib/admin-data";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdmin } from "@/lib/admin-store";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { useAdminUsers, generateTemporaryPassword } from "@/lib/admin-users";
import { useNavigate } from "@tanstack/react-router";

export function AdminDashboard() {
  const admin = useAdmin();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!admin) {
      navigate({ to: "/admin-login", replace: true });
    }
  }, [admin, navigate]);

  if (!admin) {
    return null;
  }

  return (
    <AdminLayout>
      <TooltipProvider>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#8ea3bb]">
              JURY HASH · ADMIN CONSOLE
            </p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-white">Admin Dashboard</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#8ea3bb]">
              Monitor system activity, manage users, and ensure the security and integrity of JURY
              HASH.
            </p>
          </div>
          <div className="rounded-lg border border-[#1a2737] bg-[#0a1320] p-4 max-w-xs text-left">
            <p className="text-xs text-[#8ea3bb] italic">
              “Secure systems build trust in justice.”
            </p>
            <p className="mt-2 text-[10px] text-[#5f7891]">
              — Digital India
              <br />
              Safer Citizens
              <br />
              Stronger Institutions
            </p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((metric) => (
            <div
              key={metric.id}
              className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${metric.iconBoxColor}`}
                >
                  <metric.icon className="h-5 w-5 text-white/80" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-white">{metric.value}</p>
                  <p className="mt-1 text-xs text-emerald-400">{metric.delta}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                    {metric.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">System Activity (Last 24 Hours)</h3>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1.5 text-[#38bdf8]">
                  <span
                    className="flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: ACTIVITY_COLORS.api }}
                  />
                  API Requests
                </span>
                <span className="flex items-center gap-1.5 text-[#a78bfa]">
                  <span
                    className="flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: ACTIVITY_COLORS.audit }}
                  />
                  Audit Events
                </span>
                <span className="flex items-center gap-1.5 text-[#f87171]">
                  <span
                    className="flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: ACTIVITY_COLORS.security }}
                  />
                  Security Events
                </span>
              </div>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ACTIVITY_24H} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACTIVITY_COLORS.api} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={ACTIVITY_COLORS.api} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="auditGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACTIVITY_COLORS.audit} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={ACTIVITY_COLORS.audit} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="securityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACTIVITY_COLORS.security} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={ACTIVITY_COLORS.security} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="2 4"
                    stroke="#1a2737"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="hour"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#8ea3bb", fontSize: 10 }}
                    dy={4}
                  />
                  <YAxis
                    domain={[0, 80]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#5f7891", fontSize: 10 }}
                    dx={-4}
                    width={26}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "#0a1320",
                      border: "1px solid #1a2737",
                      color: "#fff",
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "#8ea3bb" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="api"
                    stroke={ACTIVITY_COLORS.api}
                    strokeWidth={2}
                    fill="url(#apiGrad)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="audit"
                    stroke={ACTIVITY_COLORS.audit}
                    strokeWidth={2}
                    fill="url(#auditGrad)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="security"
                    stroke={ACTIVITY_COLORS.security}
                    strokeWidth={2}
                    fill="url(#securityGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
            <div className="border-b border-[#1a2737] px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Recent Security Events</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#8ea3bb] hover:text-white h-7 px-2"
                >
                  View All
                </Button>
              </div>
            </div>
            <div className="p-2 space-y-2">
              {RECENT_SECURITY_EVENTS.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
            <div className="border-b border-[#1a2737] px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">System Health</h3>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400" /> All Operational
                </span>
              </div>
            </div>
            <div className="p-2 space-y-2">
              {SYSTEM_HEALTH.map((service) => (
                <HealthRow key={service.name} service={service} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-[#1a2737] bg-[#0b131e] shadow-lg">
            <div className="border-b border-[#1a2737] px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">User Management</h3>
                  <p className="mt-0.5 text-[10px] text-[#8ea3bb]">
                    Create and manage lawyer accounts. Administrators cannot access case data.
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-[#38bdf8] text-[#0b131e] hover:bg-[#5cc0f5]"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> New User
                </Button>
              </div>
            </div>

            <div className="border-b border-[#1a2737] px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Users className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5f7891]" />
                  <Input
                    type="search"
                    placeholder="Search users..."
                    className="pl-8 bg-[#0a1320] border-[#1a2737] text-sm text-white placeholder:text-[#5f7891] focus-visible:ring-[#38bdf8]"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[130px] bg-[#0a1320] border-[#1a2737] text-sm text-white focus-visible:ring-[#38bdf8]">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1320] border border-[#1a2737]">
                    <SelectItem value="all" className="text-white">
                      All Roles
                    </SelectItem>
                    <SelectItem value="ADMIN" className="text-white">
                      Admin
                    </SelectItem>
                    <SelectItem value="LAWYER" className="text-white">
                      Lawyer
                    </SelectItem>
                    <SelectItem value="ANALYST" className="text-white">
                      Analyst
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[130px] bg-[#0a1320] border-[#1a2737] text-sm text-white focus-visible:ring-[#38bdf8]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1320] border border-[#1a2737]">
                    <SelectItem value="all" className="text-white">
                      All Status
                    </SelectItem>
                    <SelectItem value="active" className="text-white">
                      Active
                    </SelectItem>
                    <SelectItem value="pending" className="text-white">
                      Pending
                    </SelectItem>
                    <SelectItem value="inactive" className="text-white">
                      Inactive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a2737] bg-[#0a1320]">
                    <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                      <input type="checkbox" className="h-3.5 w-3.5 rounded border-[#1a2737]" />
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                      Username
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                      Full Name
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                      Role
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                      Last Login
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {USER_MANAGEMENT.map((row) => (
                    <UserRowComponent key={row.id} row={row} selected={false} onSelect={() => {}} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-[#1a2737] px-4 py-3">
              <p className="text-[10px] text-[#8ea3bb]">
                Showing 1–5 of {USER_MANAGEMENT.length} users
              </p>
              <Pagination />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <CreateUserPanel />
            <DocumentIntegrityPanel />
          </div>
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
}

function EventRow({ event }: { event: SecurityEvent }) {
  const Icon = event.type === "denied" || event.type === "blocked" ? AlertTriangle : CheckCircle;
  const badgeVariant =
    event.type === "success" ? "default" : event.type === "blocked" ? "destructive" : "secondary";
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-[#1a2737] bg-[#0a1320] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-white/80" />
          <span className="text-sm text-white">{event.title}</span>
        </div>
        <Badge
          variant={badgeVariant}
          className="cursor-default text-[10px] uppercase tracking-wider"
        >
          {event.badge}
        </Badge>
      </div>
      <p className="text-xs text-[#8ea3bb]">{event.detail}</p>
      <p className="text-[10px] text-[#5f7891] tabular-nums">{event.time}</p>
    </div>
  );
}

function HealthRow({ service }: { service: HealthService }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#1a2737] bg-[#0a1320] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className="flex h-2 w-2 rounded-full"
          style={{ backgroundColor: service.healthy ? "#34d399" : "#f87171" }}
        />
        <span className="text-sm text-white">{service.name}</span>
      </div>
      <span className="text-xs text-[#8ea3bb] tabular-nums">{service.latency}</span>
    </div>
  );
}

function UserRowComponent({
  row,
  selected,
  onSelect,
}: {
  row: UserRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const statusColor =
    row.status === "active"
      ? "text-emerald-400"
      : row.status === "pending"
        ? "text-amber-400"
        : "text-red-400";
  const statusBg =
    row.status === "active" ? "#34d399" : row.status === "pending" ? "#fbbf24" : "#f87171";
  const roleVariant =
    row.role === "ADMIN" ? "default" : row.role === "LAWYER" ? "secondary" : "outline";
  return (
    <tr className="border-b border-[#1a2737] last:border-0">
      <td className="p-3">
        <Checkbox checked={selected} onCheckedChange={onSelect} className="h-4 w-4" />
      </td>
      <td className="px-3 py-3 text-sm font-mono text-white">{row.username}</td>
      <td className="px-3 py-3 text-sm text-white">{row.fullName}</td>
      <td className="px-3 py-3">
        <Badge
          variant={roleVariant}
          className="cursor-default text-[10px] uppercase tracking-wider"
        >
          {row.role}
        </Badge>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs ${statusColor}`}>
          <span className="flex h-2 w-2 rounded-full" style={{ backgroundColor: statusBg }} />
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-[#8ea3bb] tabular-nums">{row.lastLogin}</td>
      <td className="px-3 py-3 text-right text-xs text-[#8ea3bb]">
        <button
          type="button"
          className="underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] rounded"
        >
          ...
        </button>
      </td>
    </tr>
  );
}

function CopyableHash({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  function copy() {
    if (!ref.current) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
      <span
        ref={ref}
        className="flex min-w-0 flex-1 items-center gap-2 text-xs font-mono text-white break-all"
      >
        {value}
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-sm p-1 text-[#8ea3bb] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              aria-label="Copy hash"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{copied ? "Copied" : "Copy hash"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function DocumentIntegrityPanel() {
  const doc = SAMPLE_DOCUMENT;
  const [selectedTab, setSelectedTab] = React.useState<"integrity" | "block">("integrity");
  const [copiedSha, setCopiedSha] = React.useState(false);
  const [copiedBlock, setCopiedBlock] = React.useState(false);
  const [verifyMessage, setVerifyMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [auditExpanded, setAuditExpanded] = React.useState(false);

  async function copySha() {
    if (!doc.sha256) return;
    try {
      await navigator.clipboard.writeText(doc.sha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 1500);
    } catch {
      /* clipboard unavailable in prototype */
    }
  }

  async function copyBlockHash() {
    if (!doc.blockHash) return;
    try {
      await navigator.clipboard.writeText(doc.blockHash);
      setCopiedBlock(true);
      setTimeout(() => setCopiedBlock(false), 1500);
    } catch {
      /* clipboard unavailable in prototype */
    }
  }

  function handleVerifyIntegrity() {
    setVerifyMessage({
      type: "success",
      text: "Integrity verified against block " + doc.blockNumber,
    });
    setTimeout(() => setVerifyMessage(null), 4000);
  }

  function handleViewAuditLog() {
    setAuditExpanded((prev) => !prev);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#1a2737] bg-[#0b131e] shadow-lg">
      <div className="border-b border-[#1a2737] px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Document Integrity</h3>
          <Button variant="ghost" size="sm" className="text-[#8ea3bb] hover:text-white">
            View All
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3 rounded-lg border border-[#1a2737] bg-[#0a1320] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#2a1f3d] text-white/80">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white break-all">{doc.fileName}</p>
              <Badge
                variant="default"
                className="shrink-0 text-[10px] uppercase tracking-wider text-emerald-100 border-emerald-500/40 bg-emerald-500/15 font-medium"
              >
                Verified
              </Badge>
            </div>
            <p className="mt-1 text-xs text-[#8ea3bb]">Case: {doc.caseRef}</p>
            <p className="text-[10px] text-[#5f7891]">Uploaded: {doc.uploaded}</p>
          </div>
        </div>

        <Tabs
          value={selectedTab}
          onValueChange={(v) => setSelectedTab(v as "integrity" | "block")}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-2 border border-[#1a2737]">
            <TabsTrigger value="integrity" className="text-xs">
              Integrity Details
            </TabsTrigger>
            <TabsTrigger value="block" className="text-xs">
              Block Information
            </TabsTrigger>
          </TabsList>

          <TabsContent value="integrity" className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
              <span className="text-xs text-[#8ea3bb]">SHA-256 Hash</span>
              <div className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-2 text-xs font-mono text-white break-all">
                  {doc.sha256}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={copySha}
                        className="shrink-0 rounded-sm p-1 text-[#8ea3bb] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
                        aria-label="Copy SHA-256 hash"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {copiedSha ? "Copied" : "Copy hash"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
              <span className="text-xs text-[#8ea3bb]">Block Hash</span>
              <div className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-2 text-xs font-mono text-white break-all">
                  {doc.blockHash}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={copyBlockHash}
                        className="shrink-0 rounded-sm p-1 text-[#8ea3bb] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
                        aria-label="Copy block hash"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {copiedBlock ? "Copied" : "Copy block hash"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
              <span className="text-xs text-[#8ea3bb]">Blockchain Block</span>
              <span className="text-xs font-mono text-white">{doc.blockNumber}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
              <span className="text-xs text-[#8ea3bb]">Status</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
              <span className="text-xs text-[#8ea3bb]">Modification</span>
              <span className="text-xs text-[#ff5a5a]">{doc.modification}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
              <span className="text-xs text-[#8ea3bb]">Deletion</span>
              <span className="text-xs text-[#ff5a5a]">{doc.deletion}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
              <span className="text-xs text-[#8ea3bb]">Annotations</span>
              <span className="text-xs text-white">{doc.annotations}</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="border-[#38bdf8]/40 text-[#38bdf8] hover:bg-[#38bdf8]/10"
                onClick={handleVerifyIntegrity}
              >
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verify Integrity
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[#1a2737] text-[#8ea3bb] hover:text-white"
                onClick={handleViewAuditLog}
              >
                <svg
                  className="mr-1 h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M4 4h14v6H8l-2 5v9h12v-7h2v7h6v-9l-2-5h-4V4z" />
                </svg>
                View Audit Log
              </Button>
            </div>

            {verifyMessage && (
              <div
                className={`mt-2 rounded-md border px-3 py-2 text-xs ${verifyMessage.type === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}
              >
                {verifyMessage.text}
              </div>
            )}
          </TabsContent>

          <TabsContent value="block" className="mt-4 text-xs text-[#8ea3bb]">
            {auditExpanded ? (
              <div className="rounded-md border border-[#1a2737] bg-[#0a1320] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Audit Log — {doc.fileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAuditExpanded(false)}
                    className="text-[#8ea3bb] hover:text-white"
                  >
                    Hide
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
                  <span className="text-xs text-[#8ea3bb]">Action</span>
                  <span className="text-xs text-white">Integrity Check</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
                  <span className="text-xs text-[#8ea3bb]">Result</span>
                  <span className="text-xs text-emerald-400">Passed</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
                  <span className="text-xs text-[#8ea3bb]">Block Reference</span>
                  <span className="text-xs font-mono text-white">{doc.blockNumber}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
                  <span className="text-xs text-[#8ea3bb]">Verified By</span>
                  <span className="text-xs font-mono text-white">{doc.verifiedBy}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2">
                  <span className="text-xs text-[#8ea3bb]">Timestamp</span>
                  <span className="text-xs font-mono text-white">{doc.timestamp}</span>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-[#1a2737] bg-[#0a1320] p-3">
                Block details are intentionally summarized for the prototype. A production system
                would surface full block metadata from the blockchain service.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CreateUserPanel() {
  const [fullName, setFullName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [temporaryPassword, setTemporaryPassword] = React.useState("");
  const [role, setRole] = React.useState<"LAWYER" | "ANALYST">("LAWYER");
  const [status, setStatus] = React.useState(true);
  const [createResult, setCreateResult] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const usersHook = useAdminUsers();

  function handleGenerate() {
    const generated = generateTemporaryPassword();
    setTemporaryPassword(generated);
    setCreateResult(null);
  }

  function handleCreateUser() {
    setCreateResult(null);
    if (!fullName.trim() || !username.trim() || !temporaryPassword.trim()) {
      setCreateResult({
        type: "error",
        text: "Please fill in all fields before creating the user.",
      });
      return;
    }

    const existing = usersHook.findByUsername(username.trim());
    if (existing && existing.id !== "u-admin") {
      setCreateResult({
        type: "error",
        text: `A user with username "${username.trim()}" already exists.`,
      });
      return;
    }

    const created = usersHook.add({
      fullName: fullName.trim(),
      username: username.trim(),
      role,
      status: status ? "active" : "pending",
      lastLogin: "-",
    });

    setCreateResult({
      type: "success",
      text: `User "${created.username}" created successfully.`,
    });
    setFullName("");
    setUsername("");
    setTemporaryPassword("");
    setTimeout(() => setCreateResult(null), 6000);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#1a2737] bg-[#0b131e] shadow-lg">
      <div className="border-b border-[#1a2737] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Create New User</h3>
      </div>

      <div className="space-y-4 p-4">
        {createResult && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${createResult.type === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}
          >
            {createResult.text}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-[#8ea3bb]">Full Name</label>
          <Input
            type="text"
            placeholder="e.g. Arjun Kapoor"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="bg-[#0a1320] border-[#1a2737] text-white placeholder:text-[#5f7891] focus-visible:ring-[#38bdf8]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-[#8ea3bb]">Username</label>
          <Input
            type="text"
            placeholder="e.g. arjun_k"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-[#0a1320] border-[#1a2737] text-white placeholder:text-[#5f7891] focus-visible:ring-[#38bdf8]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-[#8ea3bb]">
            Temporary Password
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="••••••••"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              className="pr-20 bg-[#0a1320] border-[#1a2737] text-white placeholder:text-[#5f7891] focus-visible:ring-[#38bdf8]"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 border-[#1a2737] text-[#8ea3bb] hover:bg-[#38bdf8]/10 hover:text-white px-2"
            >
              Generate
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] tracking-widest uppercase text-[#8ea3bb]">Role</label>
          <Select value={role} onValueChange={(v) => setRole(v as "LAWYER" | "ANALYST")}>
            <SelectTrigger className="bg-[#0a1320] border-[#1a2737] text-white focus-visible:ring-[#38bdf8]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a1320] border border-[#1a2737]">
              <SelectItem value="LAWYER" className="text-white focus:bg-[#38bdf8]/10">
                LAWYER
              </SelectItem>
              <SelectItem value="ANALYST" className="text-white focus:bg-[#38bdf8]/10">
                ANALYST
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-[#5f7891]">
            Note: New users are created with LAWYER role. Administrator access is restricted.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2.5">
          <span className="text-xs text-[#8ea3bb]">Account Status</span>
          <button
            type="button"
            onClick={() => setStatus((prev) => !prev)}
            className="flex items-center gap-3"
          >
            <span className={`text-xs ${status ? "text-emerald-400" : "text-amber-400"}`}>
              {status ? "Active" : "Pending"}
            </span>
            <span
              className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border border-[#1a2737] transition-colors ${status ? "bg-[#38bdf8]" : "bg-[#2a3f5e]"}`}
            >
              <span
                className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: status ? "translateX(10px)" : "translateX(0)" }}
              />
            </span>
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            type="button"
            className="flex-1 border-[#1a2737] text-[#8ea3bb] hover:text-white"
            onClick={() => {
              setFullName("");
              setUsername("");
              setTemporaryPassword("");
              setCreateResult(null);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 bg-[#38bdf8] text-[#0b131e] hover:bg-[#5cc0f5]"
            onClick={handleCreateUser}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Create User
          </Button>
        </div>
      </div>
    </div>
  );
}

function Pagination() {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="border-[#1a2737] text-[#8ea3bb] hover:text-white disabled:opacity-40"
        disabled
      >
        &lt;
      </Button>
      <Button variant="secondary" size="sm" className="border-[#1a2737] text-white">
        1
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="border-[#1a2737] text-white hover:bg-[#38bdf8]/10"
      >
        2
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="border-[#1a2737] text-white hover:bg-[#38bdf8]/10"
      >
        3
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="border-[#1a2737] text-[#8ea3bb] hover:text-white"
      >
        &gt;
      </Button>
    </div>
  );
}
