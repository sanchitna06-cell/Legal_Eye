import { DEFAULT_USER } from "./user-store";

/**
 * Reserved admin credential rule for the main Legal Eye sign-in screen:
 *   email: admin@legaleye.in
 *   password: admin
 *
 * This keeps the lawyer login unchanged for ordinary users while giving a
 * separate entry point into the admin console from the same sign-in surface.
 */
const ADMIN_EMAIL = "admin@legaleye.in";
const ADMIN_PASSWORD = "admin";

export function isAdminCredential(email: string, password: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
         password === ADMIN_PASSWORD;
}

/** ADMIN credential payload for the admin store, built to look like the user store profile. */
export function adminLoginPayload(): {
  name: string;
  initials: string;
  email: string;
  role: string;
  phone: string;
  systemTag: string;
  roleRaw: "admin";
} {
  return {
    name: "System Administrator",
    initials: "AD",
    email: ADMIN_EMAIL,
    role: "admin",
    phone: "",
    systemTag: "System Administrator",
    roleRaw: "admin",
  };
}
