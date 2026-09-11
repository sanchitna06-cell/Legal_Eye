import { createFileRoute } from "@tanstack/react-router";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";

export const Route = createFileRoute("/admin-login")({
  component: AdminLoginPage,
  head: () => ({
    meta: [
      { title: "Admin Sign-in — Legal Eye" },
      {
        name: "description",
        content:
          "Restricted sign-in for Legal Eye system administrators.",
      },
    ],
  }),
});

function AdminLoginPage() {
  return <AdminAuthGate />;
}
