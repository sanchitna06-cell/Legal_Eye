import { createFileRoute } from "@tanstack/react-router";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";

export const Route = createFileRoute("/admin-login")({
  component: AdminLoginPage,
  head: () => ({
    meta: [
      { title: "Admin Sign-in — Jury Hash" },
      {
        name: "description",
        content:
          "Restricted sign-in for Jury Hash system administrators.",
      },
    ],
  }),
});

function AdminLoginPage() {
  return <AdminAuthGate />;
}
