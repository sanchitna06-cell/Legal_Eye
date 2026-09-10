/**
 * In-memory user/session store.
 *
 * The signed-in user and JWT tokens exist only in browser memory.
 * Nothing is persisted to localStorage, sessionStorage, cookies,
 * or any other client-side persistent storage.
 *
 * Therefore:
 *
 *   Login
 *      ↓
 *   session + tokens stored in memory
 *      ↓
 *   normal navigation keeps the session
 *      ↓
 *   browser/page refresh
 *      ↓
 *   JavaScript state is recreated
 *      ↓
 *   session + tokens are gone
 *      ↓
 *   user must log in again
 *
 * This is intentional for the current LegalLens security model.
 */

import { useSyncExternalStore } from "react";

export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  phone: string;
}

/**
 * Current authenticated user.
 *
 * IMPORTANT:
 * This is memory-only.
 * A page refresh resets it to null.
 */
let sessionCache: UserProfile | null = null;

/**
 * JWT tokens.
 *
 * IMPORTANT:
 * These are memory-only.
 * They are deliberately NOT stored in localStorage.
 */
let accessToken: string | null = null;
let refreshToken: string | null = null;

/**
 * Subscribers used by useUser().
 */
const listeners = new Set<() => void>();

/**
 * Read the current access token.
 */
export function getAccessToken(): string | null {
  return accessToken;
}
export function isAuthenticated(): boolean {
  return accessToken !== null;
}
/**
 * Store the access and refresh tokens in memory.
 */
export function setTokens(newAccessToken: string, newRefreshToken: string) {
  accessToken = newAccessToken;
  refreshToken = newRefreshToken;
}

/**
 * Read the refresh token.
 *
 * This is currently useful for the future refresh-token flow.
 */
export function getRefreshToken(): string | null {
  return refreshToken;
}

/**
 * Clear both JWT tokens from memory.
 */
export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

/**
 * Read the current in-memory session.
 */
function readSession(): UserProfile | null {
  return sessionCache;
}

/**
 * Update the in-memory session and notify React consumers.
 */
function commitSession(user: UserProfile | null) {
  sessionCache = user;

  listeners.forEach((listener) => listener());
}

/**
 * Subscribe React components to session changes.
 */
function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Non-hook read for route guards.
 *
 * beforeLoad() runs outside React components, so it cannot use useUser().
 */
export function getSession(): UserProfile | null {
  return readSession();
}

/**
 * React hook for components that need the current user.
 */
export function useUser(): UserProfile | null {
  return useSyncExternalStore(subscribe, readSession, () => null);
}

/**
 * Start an authenticated session.
 *
 * The backend login response is mapped into UserProfile
 * by the caller and passed here.
 */
export function signIn(overrides?: Partial<UserProfile>) {
  commitSession({
    ...DEFAULT_USER,
    ...overrides,
  });
}

/**
 * End the current session.
 *
 * This clears both:
 *   1. the user session
 *   2. the JWT tokens
 *
 * Protected routes will subsequently redirect to login.
 */
export function signOut() {
  clearTokens();
  commitSession(null);
}

/**
 * Update the current user's in-memory profile.
 */
export function updateUser(patch: Partial<UserProfile>) {
  const current = readSession();

  if (!current) {
    return;
  }

  commitSession({
    ...current,
    ...patch,
  });
}

/**
 * Default lawyer profile.
 *
 * This is now only a fallback shape.
 * The real authenticated identity should come from the backend.
 */
export const DEFAULT_USER: UserProfile = {
  id: "",
  name: "",
  initials: "",
  email: "",
  role: "Lawyer",
  phone: "",
};

/**
 * Admin profile type.
 *
 * Kept for the existing admin UI while that portion of the
 * frontend remains under development.
 */
export type AdminRole = "admin";

export interface AdminUserProfile extends UserProfile {
  role: AdminRole;
  systemTag: string;
}

export const ADMIN_USER: AdminUserProfile = {
  id: "",
  name: "System Administrator",
  initials: "AD",
  email: "",
  role: "admin",
  phone: "",
  systemTag: "System Administrator",
};

/**
 * Temporary helper for the existing admin prototype.
 *
 * IMPORTANT:
 * This should NOT be used for real authentication.
 * Real admin authentication must go through the backend.
 */
export function signInAsAdmin(overrides?: Partial<AdminUserProfile>) {
  commitSession({
    ...ADMIN_USER,
    ...overrides,
  });
}
