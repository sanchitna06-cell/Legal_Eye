import { useMemo, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, Trash2, Plus, Users as UsersIcon, ShieldCheck, Clock } from "lucide-react";
import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { CreateUserPanel } from "@/components/admin/CreateUserPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { useAdminUsers, type AdminUserRecord } from "@/lib/admin-users";
import { roleVariantFor, statusBgFor, statusColorFor, type UserRow } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
  head: () => ({
    meta: [
      { title: "User Management — Legal Eye Admin" },
      {
        name: "description",
        content: "Create, review and manage Legal Eye lawyer and analyst accounts.",
      },
    ],
  }),
});

function toRow(user: AdminUserRecord): UserRow {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    lastLogin: user.lastLogin,
  };
}

function UsersPage() {
  const usersHook = useAdminUsers();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<AdminUserRecord | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [usersVersion, setUsersVersion] = useState(0);

  const users = usersHook.all();
  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      pending: users.filter((u) => u.status === "pending").length,
    }),
    [users],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !`${u.username} ${u.fullName}`.toLowerCase().includes(q)) return false;
      if (role !== "all" && u.role !== role) return false;
      if (status !== "all" && u.status !== status) return false;
      return true;
    });
  }, [users, query, role, status]);

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);

    if (target.role === "ADMIN") {
      setDeleteResult({ type: "error", text: `"${target.username}" is an administrator — admin accounts cannot be deleted.` });
      setTimeout(() => setDeleteResult(null), 6000);
      return;
    }

    const removed = usersHook.remove(target.id);
    if (removed) {
      usersHook.refresh();
      setDeleteResult({ type: "success", text: `User "${target.username}" was deleted.` });
    } else {
      setDeleteResult({ type: "error", text: `Could not delete "${target.username}" — no longer found.` });
    }
    setTimeout(() => setDeleteResult(null), 6000);
  }

  return (
    <AdminPage
      kicker="LEGAL EYE · ADMIN CONSOLE"
      title="User Management"
      description="Create and manage lawyer accounts, review pending activations, and control console access. Administrators cannot access case data."
      actions={
        <Button variant="default" size="sm" className="bg-[#38bdf8] text-[#0b131e] hover:bg-[#5cc0f5]">
          <Plus className="mr-1 h-3.5 w-3.5" /> New User
        </Button>
      }
    >
      {deleteResult && (
        <div
          className={`mb-4 rounded-md border px-3 py-2 text-xs ${
            deleteResult.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
          role="status"
        >
          {deleteResult.text}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile icon={UsersIcon} label="Total Accounts" value={String(counts.total)} tone="text-[#38bdf8]" />
        <SummaryTile icon={ShieldCheck} label="Active" value={String(counts.active)} tone="text-emerald-400" />
        <SummaryTile icon={Clock} label="Pending Activation" value={String(counts.pending)} tone="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminCard className="lg:col-span-2" title="Accounts">
          <UserFilterBar
            query={query}
            onQuery={setQuery}
            role={role}
            onRole={setRole}
            status={status}
            onStatus={setStatus}
          />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2737] bg-[#0a1320]">
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">
                    <Checkbox className="h-4 w-4" />
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">Username</th>
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">Full Name</th>
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">Role</th>
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">Status</th>
                  <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-[#8ea3bb]">Last Login</th>
                  <th className="px-3 py-3 text-right text-[10px] uppercase tracking-widest text-[#8ea3bb]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <UserRow
                    key={user.id}
                    row={toRow(user)}
                    canDelete={user.role !== "ADMIN"}
                    onDelete={() => setPendingDelete(user)}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-[#8ea3bb]">
                      No accounts match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#1a2737] px-4 py-3">
            <p className="text-[10px] text-[#8ea3bb]">
              Showing {filtered.length} of {counts.total} accounts
            </p>
          </div>
        </AdminCard>

        <CreateUserPanel
          onCreated={() => {
            usersHook.refresh();
            setUsersVersion((v) => v + 1); // re-render so the table picks up the new account
          }}
        />
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="border-[#1a2737] bg-[#0b131e]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete user "{pendingDelete?.username}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8ea3bb]">
              This permanently removes <span className="font-mono text-white">{pendingDelete?.username}</span>
              {pendingDelete?.fullName ? ` (${pendingDelete.fullName})` : ""} from Legal Eye. The account loses
              sign-in access immediately and cannot be restored from the console.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1a2737] bg-transparent text-[#8ea3bb] hover:bg-[#122236] hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-[#1a2737] bg-[#0b131e] p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${tone}`} />
        <div>
          <p className="text-2xl font-semibold text-white">{value}</p>
          <p className="text-[10px] uppercase tracking-widest text-[#8ea3bb]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function UserFilterBar({
  query,
  onQuery,
  role,
  onRole,
  status,
  onStatus,
}: {
  query: string;
  onQuery: (v: string) => void;
  role: string;
  onRole: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[#1a2737] px-4 py-3">
      <div className="relative min-w-[180px] flex-1">
        <UsersIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5f7891]" />
        <Input
          type="search"
          placeholder="Search users..."
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          className="border-[#1a2737] bg-[#0a1320] pl-8 text-sm text-white placeholder:text-[#5f7891] focus-visible:ring-[#38bdf8]"
        />
      </div>
      <Select value={role} onValueChange={onRole}>
        <SelectTrigger className="w-[130px] border-[#1a2737] bg-[#0a1320] text-sm text-white focus-visible:ring-[#38bdf8]">
          <SelectValue placeholder="All Roles" />
        </SelectTrigger>
        <SelectContent className="border border-[#1a2737] bg-[#0a1320]">
          <SelectItem value="all" className="text-white">All Roles</SelectItem>
          <SelectItem value="ADMIN" className="text-white">Admin</SelectItem>
          <SelectItem value="LAWYER" className="text-white">Lawyer</SelectItem>
          <SelectItem value="ANALYST" className="text-white">Analyst</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatus}>
        <SelectTrigger className="w-[130px] border-[#1a2737] bg-[#0a1320] text-sm text-white focus-visible:ring-[#38bdf8]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent className="border border-[#1a2737] bg-[#0a1320]">
          <SelectItem value="all" className="text-white">All Status</SelectItem>
          <SelectItem value="active" className="text-white">Active</SelectItem>
          <SelectItem value="pending" className="text-white">Pending</SelectItem>
          <SelectItem value="inactive" className="text-white">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function UserRow({
  row,
  canDelete,
  onDelete,
}: {
  row: UserRow;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-[#1a2737] last:border-0">
      <td className="p-3">
        <Checkbox className="h-4 w-4" />
      </td>
      <td className="px-3 py-3 font-mono text-sm text-white">{row.username}</td>
      <td className="px-3 py-3 text-sm text-white">{row.fullName}</td>
      <td className="px-3 py-3">
        <Badge variant={roleVariantFor(row.role)} className="cursor-default text-[10px] uppercase tracking-wider">
          {row.role}
        </Badge>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs capitalize ${statusColorFor(row.status)}`}>
          <span className="flex h-2 w-2 rounded-full" style={{ backgroundColor: statusBgFor(row.status) }} />
          {row.status}
        </span>
      </td>
      <td className="px-3 py-3 text-xs tabular-nums text-[#8ea3bb]">{row.lastLogin}</td>
      <td className="px-3 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${row.username}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#8ea3bb] transition-colors outline-none hover:border-[#1a2737] hover:bg-[#122236] hover:text-white focus-visible:ring-2 focus-visible:ring-[#38bdf8] disabled:pointer-events-none disabled:opacity-40 data-[state=open]:border-[#1a2737] data-[state=open]:bg-[#122236] data-[state=open]:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-[#1a2737] bg-[#0a1320] text-white">
            <DropdownMenuItem disabled className="text-[#5f7891]">
              View profile
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="text-[#5f7891]">
              Reset password
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#1a2737]" />
            <DropdownMenuItem
              disabled={!canDelete}
              className="text-red-300 focus:bg-red-500/15 focus:text-red-200 data-[disabled]:opacity-40"
              onSelect={() => onDelete()}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
