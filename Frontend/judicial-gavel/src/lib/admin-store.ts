/** Frontend-only admin session store.

 * Mirrors the existing user-store/case-store pattern: one module owns the
 * admin session, reads go through `useAdmin`, and the session is persisted in
 * localStorage so refresh keeps the signed-in admin state until sign-out.
 *
 * Credential check is prototype-only: the only supported admin sign-in is
 * ADMIN / ADMIN, matching the requested access rule. A real auth service would
 * replace `checkAdminCredentials` / `commitSession` / `readSession`.
 */

import { useSyncExternalStore } from "react";

const ADMIN_SESSION_KEY = "legal-eye.admin.session.v1";
const ADMIN_USERNAME = "ADMIN";
const ADMIN_PASSWORD = "admin";

// Back-compat alias used by the standalone /admin-login screen.
let adminCache: AdminUser | null | undefined; // undefined = not yet read
const adminListeners = new Set<() => void>();

export interface AdminUser {
  name: string;
  initials: string;
  username: string;
}

function readAdminSession(): AdminUser | null {
  if (typeof window === "undefined") return null;
  if (adminCache !== undefined) return adminCache;
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    adminCache = raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    adminCache = null;
  }
  return adminCache;
}

function commitAdminSession(user: AdminUser | null) {
  adminCache = user;
  if (typeof window !== "undefined") {
    try {
      if (user) window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(user));
      else window.localStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      /* storage unavailable — session-only */
    }
  }
  adminListeners.forEach((l) => l());
}

function subscribeAdmin(listener: () => void) {
  adminListeners.add(listener);
  return () => adminListeners.delete(listener);
}

export function getAdminSession(): AdminUser | null {
  return readAdminSession();
}

export function useAdmin(): AdminUser | null {
  return useSyncExternalStore(subscribeAdmin, readAdminSession, () => null);
}

export function checkAdminCredentials(
  username: string,
  password: string,
): boolean {
  return (
    username.trim().toLowerCase() ===
      ADMIN_USERNAME.toLowerCase() &&
    password === ADMIN_PASSWORD
  );
}

export function signInAsAdmin(user: AdminUser) {
  commitAdminSession(user);
}

export function signOutAdmin() {
  commitAdminSession(null);
}

export const DEFAULT_ADMIN_USER: AdminUser = {
  name: "System Administrator",
  initials: "AD",
  username: "ADMIN",
};
