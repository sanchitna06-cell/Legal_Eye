import React from "react";
import { createFileRoute, ClientOnly, Outlet, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useUser } from "@/lib/user-store";

/**
 * Layout route for every /admin/* page.
 *
 * The route is publicly reachable; a client-side guard redirects non-admin
 * visitors to /admin-login (the session lives in localStorage, so the check
 * has to run on the client). Signed-in admins get the shared AdminLayout with
 * the sidebar; child routes render into the <Outlet />.
 */
function AdminRouteShell() {
  return (
    <ClientOnly fallback={null}>
      <AdminGate>
        <AdminLayout>
          <Outlet />
        </AdminLayout>
      </AdminGate>
    </ClientOnly>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!user) {
      navigate({ to: "/admin-login", replace: true });
      return;
    }

    if (user.role !== "ADMIN") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, navigate]);

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  return <>{children}</>;
}
export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    // See AdminRouteShell: the guard is client-side.
  },
  component: AdminRouteShell,
  head: () => ({
    meta: [
      { title: "Admin Console — Jury Hash" },
      {
        name: "description",
        content:
          "Jury Hash admin console: monitor system activity, manage users, and ensure the security and integrity of the platform.",
      },
    ],
  }),
});
