/**
 * Frontend-only admin console settings store.
 *
 * Mirrors the admin-session store pattern: one module owns the settings state,
 * reads go through `useAdminSettings`, and values persist in localStorage so
 * the console remembers configuration between visits. A real system would
 * replace this with server-backed preferences.
 */

import { useSyncExternalStore } from "react";

const SETTINGS_KEY = "legal-eye.admin.settings.v1";

export interface AdminSettings {
  emailAlerts: boolean;
  securityAlerts: boolean;
  weeklyReport: boolean;
  sessionTimeoutMinutes: number;
  auditRetentionDays: number;
  maintenanceMode: boolean;
}

export const DEFAULT_SETTINGS: AdminSettings = {
  emailAlerts: true,
  securityAlerts: true,
  weeklyReport: false,
  sessionTimeoutMinutes: 30,
  auditRetentionDays: 365,
  maintenanceMode: false,
};

let settingsCache: AdminSettings | undefined; // undefined = not yet read
const listeners = new Set<() => void>();

function readSettings(): AdminSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  if (settingsCache !== undefined) return settingsCache;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    settingsCache = raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AdminSettings>) }
      : DEFAULT_SETTINGS;
  } catch {
    settingsCache = DEFAULT_SETTINGS;
  }
  return settingsCache;
}

function commitSettings(next: AdminSettings) {
  settingsCache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — session-only */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAdminSettings(): AdminSettings {
  return readSettings();
}

export function useAdminSettings(): AdminSettings {
  return useSyncExternalStore(subscribe, readSettings, () => DEFAULT_SETTINGS);
}

export function updateAdminSetting<K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) {
  commitSettings({ ...readSettings(), [key]: value });
}

export function resetAdminSettings() {
  commitSettings(DEFAULT_SETTINGS);
}
