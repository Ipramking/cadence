import { BmoniError } from "@cadence/shared";

const BASE = process.env.BMONI_BASE_URL ?? "https://embedded-dev.bmoni.com";
const KEY = process.env.BMONI_API_KEY ?? "";

/** Thin authenticated fetch against the BMONI sandbox. Server-side only. */
export async function bmoniFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  // Fail fast rather than hang into an upstream gateway timeout (Render free tier).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 12000);
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: init.method ?? "GET",
      headers: { "x-api-key": KEY, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new BmoniError(
      e instanceof Error && e.name === "AbortError" ? "BMONI request timed out" : "BMONI request failed",
      "network",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const m = (data as { message?: unknown })?.message;
    const msg = Array.isArray(m) ? m.join("; ") : (m ?? `HTTP ${res.status}`);
    throw new BmoniError(String(msg), String(res.status));
  }
  return data as T;
}
