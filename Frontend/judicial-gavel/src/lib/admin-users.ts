/**
 * In-memory admin user store prototype.
 *
 * This is frontend-only sample data so the admin console has a working user
 * management surface. It persists recent changes in localStorage so refreshes
 * keep created/updated users during the session. A real system would replace
 * this with backend-backed storage.
 */

import { useEffect, useRef } from "react";

export type AdminUserRole = "ADMIN" | "LAWYER" | "ANALYST";
export type AdminUserStatus = "active" | "pending" | "inactive";

export interface AdminUserRecord {
  id: string;
  username: string;
  fullName: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  lastLogin: string;
  createdAt: string;
}

const STORAGE_KEY = "legal-eye.admin.users.v1";

const SEED_USERS: AdminUserRecord[] = [
  {
    id: "u-admin",
    username: "admin",
    fullName: "System Administrator",
    role: "ADMIN",
    status: "active",
    lastLogin: "05 Sep 2026, 22:10",
    createdAt: "01 Sep 2026, 09:12",
  },
  {
    id: "u-lawyer_a",
    username: "lawyer_a",
    fullName: "Aarav Mehta",
    role: "LAWYER",
    status: "active",
    lastLogin: "05 Sep 2026, 21:14",
    createdAt: "02 Sep 2026, 10:05",
  },
  {
    id: "u-lawyer_b",
    username: "lawyer_b",
    fullName: "Priya Sharma",
    role: "LAWYER",
    status: "active",
    lastLogin: "05 Sep 2026, 20:03",
    createdAt: "03 Sep 2026, 11:30",
  },
  {
    id: "u-lawyer_c",
    username: "lawyer_c",
    fullName: "Rohit Verma",
    role: "LAWYER",
    status: "pending",
    lastLogin: "-",
    createdAt: "04 Sep 2026, 14:20",
  },
  {
    id: "u-analyst_1",
    username: "analyst_1",
    fullName: "Data Analyst",
    role: "ANALYST",
    status: "inactive",
    lastLogin: "02 Sep 2026, 11:22",
    createdAt: "01 Sep 2026, 16:40",
  },
];

function readUsers(): AdminUserRecord[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return SEED_USERS.map((u) => ({ ...u }));
    const parsed = JSON.parse(raw) as AdminUserRecord[];
    if (parsed.length === 0) return SEED_USERS.map((u) => ({ ...u }));
    return parsed;
  } catch {
    return SEED_USERS.map((u) => ({ ...u }));
  }
}

function writeUsers(users: AdminUserRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {
    /* ignore storage failures in prototype */
  }
}

let users: AdminUserRecord[] = [];
let seedFunded = false;

function ensureSeed() {
  if (seedFunded) return;
  seedFunded = true;
  users = readUsers();
}

export function useAdminUsers() {
  const usersRef = useRef(users);
  const reloadRef = useRef(0);

  useEffect(() => {
    ensureSeed();
    usersRef.current = users;
    reloadRef.current += 1;
  }, [reloadRef.current]);

  function refresh() {
    ensureSeed();
    usersRef.current = users;
    reloadRef.current += 1;
  }

  function syncFromStore() {
    ensureSeed();
    usersRef.current = users;
  }

  function all(): AdminUserRecord[] {
    syncFromStore();
    return usersRef.current.map((u) => ({ ...u }));
  }

  function findById(id: string): AdminUserRecord | undefined {
    syncFromStore();
    return usersRef.current.find((u) => u.id === id);
  }

  function findByUsername(username: string): AdminUserRecord | undefined {
    syncFromStore();
    return usersRef.current.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
  }

  function add(user: Omit<AdminUserRecord, "id" | "createdAt">): AdminUserRecord {
    ensureSeed();
    const newUser: AdminUserRecord = {
      ...user,
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    };
    users = [...users, newUser];
    writeUsers(users);
    usersRef.current = users;
    reloadRef.current += 1;
    return newUser;
  }

  function update(id: string, patch: Partial<AdminUserRecord>): AdminUserRecord | null {
    ensureSeed();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
    writeUsers(users);
    usersRef.current = users;
    reloadRef.current += 1;
    return users[idx] ?? null;
  }

  function remove(id: string): boolean {
    ensureSeed();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    users = users.filter((u) => u.id !== id);
    writeUsers(users);
    usersRef.current = users;
    reloadRef.current += 1;
    return true;
  }

  return { all, findById, findByUsername, add, update, remove, refresh };
}

export function generateTemporaryPassword(length = 10): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const chars = upper + lower + digits;
  let password = "";
  let lastType = -1;
  for (let i = 0; i < length; i++) {
    let type: number;
    do {
      type = Math.floor(Math.random() * 3);
    } while (type === lastType && i > 0);
    lastType = type;
    const pool = type === 0 ? upper : type === 1 ? lower : digits;
    password += pool[Math.floor(Math.random() * pool.length)];
  }
  return password;
}
