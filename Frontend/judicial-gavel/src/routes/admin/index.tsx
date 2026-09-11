import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Legal Eye" },
      {
        name: "description",
        content:
          "Legal Eye admin console: monitor system activity, manage users, and ensure the security and integrity of the platform.",
      },
    ],
  }),
});
