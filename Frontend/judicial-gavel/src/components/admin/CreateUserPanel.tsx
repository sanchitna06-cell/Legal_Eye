import React from "react";
import { Plus } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { createAdminUser } from "@/lib/api";

export function CreateUserPanel({ onCreated }: { onCreated?: () => void }) {
  const [fullName, setFullName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [temporaryPassword, setTemporaryPassword] = React.useState("");
  const [role] = React.useState<"LAWYER">("LAWYER");
  const [status, setStatus] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [createResult, setCreateResult] =
    React.useState<{
      type: "success" | "error";
      text: string;
    } | null>(null);


  function handleGenerate() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);

    const generated = Array.from(bytes, (byte) =>
      byte.toString(36),
    )
      .join("")
      .slice(0, 12);

    setTemporaryPassword(generated);
    setCreateResult(null);
  }

  async function handleCreateUser() {
  setCreateResult(null);

  if (
    !fullName.trim() ||
    !username.trim() ||
    !temporaryPassword.trim()
  ) {
    setCreateResult({
      type: "error",
      text: "Please fill in all fields before creating the user.",
    });
    return;
  }

  if (temporaryPassword.trim().length < 8) {
    setCreateResult({
      type: "error",
      text: "Temporary password must be at least 8 characters.",
    });
    return;
  }

  try {
    setCreating(true);

    const created = await createAdminUser({
      full_name: fullName.trim(),
      username: username.trim(),
      temporary_password: temporaryPassword.trim(),
      is_active: status,
    });

    setCreateResult({
      type: "success",
      text: `User "${created.user.username}" created successfully.`,
    });

    setFullName("");
    setUsername("");
    setTemporaryPassword("");

    onCreated?.();

    setTimeout(() => setCreateResult(null), 6000);
  } catch (error) {
    setCreateResult({
      type: "error",
      text:
        error instanceof Error
          ? error.message
          : "Failed to create user.",
    });
  } finally {
    setCreating(false);
  }
}
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#1a2737] bg-[#0b131e] shadow-lg">
      <div className="border-b border-[#1a2737] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Create New User</h3>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        {createResult && (
          <div className={`rounded-md border px-3 py-2 text-xs ${createResult.type === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
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
          <label className="text-[10px] tracking-widest uppercase text-[#8ea3bb]">Temporary Password</label>
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
          <Select value={role} disabled>
            <SelectTrigger className="bg-[#0a1320] border-[#1a2737] text-white focus-visible:ring-[#38bdf8]">
            <SelectValue />
            </SelectTrigger>

              <SelectContent className="bg-[#0a1320] border border-[#1a2737]">
              <SelectItem
                value="LAWYER"
                className="text-white focus:bg-[#38bdf8]/10"
              >
                LAWYER
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-[#5f7891]">
            New accounts created here are assigned the LAWYER role.
            Administrator access is restricted.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-md border border-[#1a2737] bg-[#0a1320] px-3 py-2.5">
          <span className="text-xs text-[#8ea3bb]">Account Status</span>
          <button type="button" onClick={() => setStatus((prev) => !prev)} className="flex items-center gap-3">
            <span className={`text-xs ${status ? "text-emerald-400" : "text-amber-400"}`}>{status ? "Active" : "Pending"}</span>
            <span className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border border-[#1a2737] transition-colors ${status ? "bg-[#38bdf8]" : "bg-[#2a3f5e]"}`}>
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
            disabled={creating}
            className="flex-1 bg-[#38bdf8] text-[#0b131e] hover:bg-[#5cc0f5] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleCreateUser}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {creating ? "Creating…" : "Create User"}
          </Button>
        </div>
      </div>
    </div>
  );
}
