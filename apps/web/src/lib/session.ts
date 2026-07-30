"use client";

import { clearToken, getToken, type AuthUser } from "./api";

const KEY = "cadence_session";
const RECEIPTS = "cadence_receipts";

export type Autonomy = "manual" | "hybrid" | "automatic";

/**
 * Local mirror of the signed-in user. The server (BMONI + Prisma) is the source
 * of truth; this cache lets the UI read profile/prefs synchronously and keeps
 * the PIN / safe-word on-device (they're verified locally before a payment).
 */
export interface Session {
  name: string;
  email: string;
  phone?: string;
  autonomy: Autonomy;
  planEnabled: boolean;
  pin?: string;
  safeWord?: string;
  knownRecipients: string[];
  onboarded: boolean;
}

const DEFAULTS: Session = {
  name: "there",
  email: "",
  autonomy: "automatic",
  planEnabled: false,
  knownRecipients: [],
  onboarded: false,
};

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (!getToken()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Merge a fresh server user into the local mirror (keeps on-device secrets). */
export function cacheUser(u: AuthUser): Session {
  const prev = getSession() ?? { ...DEFAULTS };
  const s: Session = {
    ...prev,
    name: u.name?.trim() || "there",
    email: u.email,
    phone: u.phone ?? prev.phone,
    autonomy: u.autonomy,
    planEnabled: u.planEnabled,
    onboarded: u.onboarded,
  };
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

export function updateSession(patch: Partial<Session>): Session {
  const s = { ...DEFAULTS, ...getSession(), ...patch } as Session;
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

export function completeOnboarding(): void {
  updateSession({ onboarded: true });
}

export function signOut(): void {
  clearToken();
  localStorage.removeItem(KEY);
  localStorage.removeItem(RECEIPTS);
}

export function isSignedIn(): boolean {
  return typeof window !== "undefined" && !!getToken();
}

export function isOnboarded(): boolean {
  return getSession()?.onboarded === true;
}

export function rememberRecipient(name: string): void {
  const s = getSession();
  if (!s) return;
  const key = name.trim().toLowerCase();
  if (!key || s.knownRecipients.includes(key)) return;
  updateSession({ knownRecipients: [...s.knownRecipients, key] });
}

// ── Receipts: persist across sessions (chat itself is ephemeral) ──
export interface Receipt {
  id: string;
  reference?: string;
  txType?: string;
  recipient: string;
  amountMinor: number;
  currency: string;
  route?: { fromCurrency: string; rate: number; sourceMinor: number } | null;
  note?: string | null;
  at: string;
}

export function getReceipts(): Receipt[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECEIPTS) || "[]");
  } catch {
    return [];
  }
}

export function addReceipt(r: Receipt): void {
  const all = [r, ...getReceipts()].slice(0, 50);
  localStorage.setItem(RECEIPTS, JSON.stringify(all));
}
