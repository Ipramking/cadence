"use client";

const KEY = "cadence_session";
const RECEIPTS = "cadence_receipts";

export type Autonomy = "manual" | "hybrid" | "automatic";

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
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function signIn(name: string, email: string): Session {
  // Every sign-in starts a fresh account so onboarding always runs.
  const s: Session = { ...DEFAULTS, name, email };
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
  localStorage.removeItem(KEY);
}

export function isSignedIn(): boolean {
  return getSession() !== null;
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
