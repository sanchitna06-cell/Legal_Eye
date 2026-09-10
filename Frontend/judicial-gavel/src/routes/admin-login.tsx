import { createFileRoute } from "@tanstack/react-router";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";

export const Route = createFileRoute("/admin-login")({
  component: AdminLoginPage,
  head: () => ({
    meta: [
      { title: "Admin Sign-in — JURY HASH" },
      {
        name: "description",
        content: "Restricted sign-in for JURY HASH system administrators.",
      },
    ],
  }),
});

function AdminLoginPage() {
  return <AdminAuthGate />;
}
