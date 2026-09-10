import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

function AdminRouteShell() {
  return (
    <ClientOnly fallback={null}>
      <AdminDashboard />
    </ClientOnly>
  );
}

export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    // Route is publicly reachable; client-side guard in AdminDashboard
    // redirects non-admin visitors to /admin-login.
  },
  component: AdminRouteShell,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — JURY HASH" },
      {
        name: "description",
        content:
          "JURY HASH admin console: monitor system activity, manage users, and ensure the security and integrity of the platform.",
      },
    ],
  }),
});
