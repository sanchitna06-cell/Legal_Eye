import { useEffect, useMemo, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  RefreshCw,
  Users as UsersIcon,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { AdminPage, AdminCard } from "@/components/admin/AdminPage";
import { CreateUserPanel } from "@/components/admin/CreateUserPanel";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";
import {
  getAdminUsers,
  deleteAdminUser,
  deactivateAdminUser,
  activateAdminUser,
  type AdminUser,
} from "@/lib/api";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
  head: () => ({
    meta: [
      { title: "User Management — JURY HASH Admin" },
      {
        name: "description",
        content:
          "Create, review and manage JURY HASH administrator and lawyer accounts.",
      },
    ],
  }),
});

function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "delete" | "deactivate" | "activate";
    user: AdminUser;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);

      const response = await getAdminUsers(0, 500);
      setUsers(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function handleConfirmAction() {
  if (!pendingAction || actionLoading) return;

  const { type, user } = pendingAction;

  try {
    setActionLoading(true);
    setActionError(null);

  if (type === "delete") {
    await deleteAdminUser(user.id);
  } else if (type === "deactivate") {
    await deactivateAdminUser(user.id);
  } else {
    await activateAdminUser(user.id);
  }

    setPendingAction(null);
    await loadUsers();
  } catch (error) {
    setActionError(
      error instanceof Error
        ? error.message
        : `Failed to ${type} user.`,
    );
  } finally {
    setActionLoading(false);
  }
}

  useEffect(() => {
    void loadUsers();
  }, []);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.is_active).length,
      administrators: users.filter((user) => user.role === "ADMIN").length,
    }),
    [users],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return users.filter((user) => {
      if (
        q &&
        !`${user.username} ${user.full_name} ${user.id}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }

      if (role !== "all" && user.role !== role) {
        return false;
      }

      if (status === "active" && !user.is_active) {
        return false;
      }

      if (status === "inactive" && user.is_active) {
        return false;
      }

      return true;
    });
  }, [users, query, role, status]);

  return (
    <AdminPage
      kicker="JURY HASH · ADMIN CONSOLE"
      title="User Management"
      description="Create and review administrator and lawyer accounts and monitor console access."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadUsers()}
          disabled={loading}
          className="border-[#1a2737] text-[#8ea3bb] hover:text-white"
        >
          <RefreshCw
            className={`mr-1 h-3.5 w-3.5 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh
        </Button>
      }
    >
      {error && (
        <div className="admin-alert admin-alert--danger">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile
          icon={UsersIcon}
          label="Total Accounts"
          value={loading ? "—" : String(counts.total)}
          tone="cyan"
        />

        <SummaryTile
          icon={ShieldCheck}
          label="Active Accounts"
          value={loading ? "—" : String(counts.active)}
          tone="green"
        />

        <SummaryTile
          icon={ShieldCheck}
          label="Administrators"
          value={loading ? "—" : String(counts.administrators)}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminCard
          className="admin-card--large"
          title="Accounts"
          subtitle="Current accounts returned by the backend"
        >
          <UserFilterBar
            query={query}
            onQuery={setQuery}
            role={role}
            onRole={setRole}
            status={status}
            onStatus={setStatus}
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="admin-table-head">
                  <th className="admin-table-heading">
                    Username
                  </th>

                  <th className="admin-table-heading">
                    Full Name
                  </th>

                  <th className="admin-table-heading">
                    Role
                  </th>

                  <th className="admin-table-heading">
                    Status
                  </th>

                  <th className="admin-table-heading">
                    Password
                  </th>

                  <th className="admin-table-heading">
                    Last Login
                  </th>

                  <th className="admin-table-heading">
                    Created
                  </th>
                  <th className="admin-table-heading admin-table-heading--right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <>
                    <LoadingRow />
                    <LoadingRow />
                    <LoadingRow />
                    <LoadingRow />
                  </>
                ) : (
                  filtered.map((user) => (
                  <UserTableRow
                    key={user.id}
                    user={user}
                    onAction={setPendingAction}
                  />
                  ))
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                       className="admin-table-empty"
                    >
                      {query || role !== "all" || status !== "all"
                        ? "No accounts match the current filters."
                        : "No accounts were returned by the backend."}
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
    void loadUsers();
  }}
/>
</div>

<AlertDialog
  open={pendingAction !== null}
  onOpenChange={(open) => {
    if (!open && !actionLoading) {
      setPendingAction(null);
      setActionError(null);
    }
  }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
    <AlertDialogTitle>
      {pendingAction?.type === "delete"
        ? "Delete user?"
        : pendingAction?.type === "deactivate"
        ? "Deactivate user?"
        : "Activate user?"}
    </AlertDialogTitle>

      <AlertDialogDescription>
        {pendingAction?.type === "delete" ? (
        <>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">
            {pendingAction.user.username}
          </span>
          . This action cannot be undone.
        </>
      ) : pendingAction?.type === "deactivate" ? (
        <>
          This will disable{" "}
          <span className="font-medium text-foreground">
            {pendingAction.user.username}
          </span>
          's access while preserving their legal and audit history.
        </>
      ) : (
        <>
          This will restore sign-in access for{" "}
          <span className="font-medium text-foreground">
            {pendingAction?.user.username}
          </span>
          .
        </>
      )}
    </AlertDialogDescription>
    </AlertDialogHeader>

    {actionError && (
      <div
        role="alert"
        className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
      >
        {actionError}
      </div>
    )}

    <AlertDialogFooter>
      <AlertDialogCancel disabled={actionLoading}>
        Cancel
      </AlertDialogCancel>

      <AlertDialogAction
        disabled={actionLoading}
        onClick={(event) => {
          event.preventDefault();
          void handleConfirmAction();
        }}
        className={`admin-dialog-action ${
          pendingAction?.type === "delete"
        ? "admin-dialog-action--danger"
        : pendingAction?.type === "deactivate"
        ? "admin-dialog-action--warning"
        : "admin-dialog-action--success"
      }`}
      >
        {actionLoading
          ? "Processing…"
          : pendingAction?.type === "delete"
            ? "Delete User"
            : pendingAction?.type === "deactivate"
              ? "Deactivate User"
              : "Activate User"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog></AdminPage>
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
  tone: "cyan" | "green" | "amber";
}) {
  return (
    <div className="admin-metric">
      <div className="admin-metric__icon">
        <Icon className={`admin-metric__icon-svg admin-metric__icon-svg--${tone}`} />
      </div>

      <div className="admin-metric__content">
        <p className="admin-metric__value">
          {value}
        </p>

        <p className="admin-metric__label">
          {label}
        </p>
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
  onQuery: (value: string) => void;
  role: string;
  onRole: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
}) {
  return (
    <div className="admin-user-filters">
      <div className="admin-user-filters__search">
        <UsersIcon className="admin-user-filters__search-icon" />

        <Input
          type="search"
          placeholder="Search users..."
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="admin-input admin-user-filters__input"
        />
      </div>

      <Select value={role} onValueChange={onRole}>
        <SelectTrigger className="admin-select">
          <SelectValue placeholder="All Roles" />
        </SelectTrigger>

        <SelectContent className="admin-select__content">
          <SelectItem value="all">
            All Roles
          </SelectItem>

          <SelectItem value="ADMIN">
            Admin
          </SelectItem>

          <SelectItem value="LAWYER">
            Lawyer
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={onStatus}>
        <SelectTrigger className="admin-select">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>

        <SelectContent className="admin-select__content">
          <SelectItem value="all">
            All Status
          </SelectItem>

          <SelectItem value="active">
            Active
          </SelectItem>

          <SelectItem value="inactive">
            Inactive
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function UserTableRow({
  user,
  onAction,
}: {
  user: AdminUser;
  onAction: (action: {
    type: "delete" | "deactivate" | "activate";
    user: AdminUser;
  }) => void;
}) {
  return (
    <tr className="admin-table-row">
      <td className="admin-table-cell admin-table-cell--username">
        {user.username}
      </td>

      <td className="admin-table-cell">
        {user.full_name}
      </td>

      <td className="admin-table-cell">
        <span
          className={`admin-role-badge admin-role-badge--${
            user.role === "ADMIN" ? "admin" : "lawyer"
          }`}
        >
          {user.role}
        </span>
      </td>

      <td className="admin-table-cell">
        <span
          className={`admin-user-status ${
            user.is_active
              ? "admin-user-status--active"
              : "admin-user-status--inactive"
          }`}
        >
          <span className="admin-user-status__dot" />
          {user.is_active ? "Active" : "Inactive"}
        </span>
      </td>

      <td className="admin-table-cell">
        {user.must_change_password ? (
          <span className="admin-password-status admin-password-status--required">
            Change required
          </span>
        ) : (
          <span className="admin-password-status admin-password-status--set">
            Set
          </span>
        )}
      </td>

      <td className="admin-table-cell admin-table-cell--muted">
        {formatDate(user.last_login)}
      </td>

      <td className="admin-table-cell admin-table-cell--muted">
        {formatDate(user.created_at)}
      </td>

      <td className="admin-table-cell admin-table-cell--actions">
        {user.role === "LAWYER" && (
          <div className="admin-user-actions">
            {user.is_active ? (
              <button
                type="button"
                onClick={() =>
                  onAction({
                    type: "deactivate",
                    user,
                  })
                }
                className="admin-action admin-action--warning"
              >
                Deactivate
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onAction({
                    type: "activate",
                    user,
                  })
                }
                className="admin-action admin-action--success"
              >
                Activate
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onAction({
                  type: "delete",
                  user,
                })
              }
              className="admin-action admin-action--danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
function LoadingRow() {
  return (
    <tr className="admin-table-row">
      <td colSpan={8} className="admin-table-empty">
        Loading users…
      </td>
    </tr>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}