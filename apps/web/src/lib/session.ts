"use client";

const KEY = "cadence_session";

export interface Session {
  name: string;
  email: string;
  onboarded: boolean;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function signIn(name: string, email: string): Session {
  const existing = getSession();
  const s: Session = { name, email, onboarded: existing?.onboarded ?? false };
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

export function completeOnboarding(): void {
  const s = getSession();
  if (!s) return;
  localStorage.setItem(KEY, JSON.stringify({ ...s, onboarded: true }));
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
