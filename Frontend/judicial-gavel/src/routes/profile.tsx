import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, LogOut, Mail, Phone, Scale, User } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  DEFAULT_USER,
  getSession,
  signOut,
  updateUser,
  useUser,
  type UserProfile,
} from "@/lib/user-store";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => {
    if (!getSession()) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Profile Settings — JURY HASH" },
      {
        name: "description",
        content:
          "Your JURY HASH profile — the name, contact details and role attached to your chamber account.",
      },
    ],
  }),
  component: ProfilePage,
});

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "LE";
  const first = words[0]!;
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  const second = words[1]!;
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
}

function ProfilePage() {
  const user = useUser();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<UserProfile>(() => ({
    id: user?.id ?? DEFAULT_USER.id,
    name: user?.name ?? DEFAULT_USER.name,
    initials: user?.initials ?? DEFAULT_USER.initials,
    email: user?.email ?? DEFAULT_USER.email,
    role: user?.role ?? DEFAULT_USER.role,
    phone: user?.phone ?? DEFAULT_USER.phone,
  }));
  const [saved, setSaved] = useState(false);

  // Keep the draft in step with the session (e.g. first sign-in) without
  // trampling an in-progress edit — the session object only changes identity
  // when it is persisted.
  useEffect(() => {
    if (!user) return;
    setDraft((d) => {
      if (
        d.name === user.name &&
        d.email === user.email &&
        d.role === user.role &&
        d.phone === user.phone &&
        d.initials === user.initials
      ) {
        return d;
      }
      return user;
    });
  }, [user]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2600);
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (!user) return null;

  function setField(field: keyof UserProfile, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim() || DEFAULT_USER.name;
    updateUser({
      name,
      initials: initialsOf(name),
      email: draft.email.trim(),
      role: draft.role.trim() || DEFAULT_USER.role,
      phone: draft.phone.trim(),
    });
    setSaved(true);
  }

  function handleSignOut() {
    signOut();
    navigate({ to: "/" });
  }

  const fields: Array<{
    key: "name" | "email" | "role" | "phone";
    label: string;
    icon: typeof User;
    type: string;
    placeholder: string;
    autoComplete: string;
    note: string;
  }> = [
    {
      key: "name",
      label: "Full name",
      icon: User,
      type: "text",
      placeholder: "Your name",
      autoComplete: "name",
      note: "Shown on the dashboard greeting and account menu.",
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      type: "email",
      placeholder: "name@chambers.in",
      autoComplete: "email",
      note: "The address you sign in with.",
    },
    {
      key: "role",
      label: "Role",
      icon: Scale,
      type: "text",
      placeholder: "Lawyer",
      autoComplete: "organization-title",
      note: "Your standing on the record, e.g. Advocate or Senior Counsel.",
    },
    {
      key: "phone",
      label: "Phone",
      icon: Phone,
      type: "tel",
      placeholder: "Add a contact number",
      autoComplete: "tel",
      note: draft.phone.trim() ? "Contact number on your record." : "Not recorded yet.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <div className="pt-10 sm:pt-14">
          <p className="label-legal">Chambers Account</p>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-none tracking-[-0.01em] text-parchment">
              Profile Settings
            </h1>
            <span className="font-mono text-[11px] tracking-[0.14em] text-brass-dim">
              Personal profile
            </span>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The details held against your chamber account. Changes apply across the dashboard and
            case records immediately.
          </p>
          <div className="mt-6 h-px w-full rule-brass" />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
          <form onSubmit={handleSave} className="chamber-panel grain p-6 sm:p-8">
            <div className="flex items-center gap-4 border-b border-border pb-6">
              <span className="flex h-14 w-14 items-center justify-center border border-brass-dim font-display text-lg text-brass">
                {draft.initials || "LE"}
              </span>
              <div>
                <p className="font-display text-lg text-parchment">
                  {draft.name.trim() || "Unnamed user"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {draft.role.trim() || "Lawyer"}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {fields.map((field) => {
                const Icon = field.icon;
                return (
                  <div key={field.key} className="space-y-2">
                    <label
                      htmlFor={`profile-${field.key}`}
                      className="label-legal flex items-center gap-2"
                    >
                      <Icon className="h-3.5 w-3.5 text-brass-dim" />
                      {field.label}
                    </label>
                    <input
                      id={`profile-${field.key}`}
                      type={field.type}
                      value={draft[field.key]}
                      onChange={(e) => setField(field.key, e.target.value)}
                      autoComplete={field.autoComplete}
                      placeholder={field.placeholder}
                      className="focus-legal w-full border-b border-input bg-transparent pb-2 text-sm text-parchment outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-brass-dim focus:border-brass"
                    />
                    <p className="text-[11px] text-muted-foreground/80">{field.note}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border pt-6">
              <button
                type="submit"
                className="focus-legal inline-flex items-center gap-2 border border-brass/60 bg-brass px-6 py-3 text-sm font-medium tracking-wide text-primary-foreground transition-colors hover:bg-brass/90"
              >
                Save changes
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-xs text-olive">
                  <Check className="h-3.5 w-3.5" />
                  Profile updated
                </span>
              )}
            </div>
          </form>

          <aside className="space-y-6">
            <div className="border border-border p-5">
              <p className="label-legal">Session</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Signed in as <span className="text-parchment">{user.email || user.name}</span>. This
                prototype keeps the session on this device only.
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                className="focus-legal mt-5 inline-flex items-center gap-2 border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-burgundy/70 hover:text-burgundy"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
