const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface OverviewWallet {
  id: string;
  name: string;
  purpose: string;
  currency: string;
  balance: { minor: number; currency: string };
}

export interface Overview {
  wallets: OverviewWallet[];
  rate: { from: string; to: string; rate: number; asOf: string };
}

export async function getOverview(): Promise<Overview> {
  const res = await fetch(`${BASE}/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error(`overview ${res.status}`);
  return res.json();
}

export interface InflowPreview {
  amountUsd: number;
  rate: number;
  currency: string;
  receivesMinor: number;
  savedVsBankMinor: number;
}

export async function previewInflow(amountUsd: number): Promise<InflowPreview> {
  const res = await fetch(`${BASE}/pipeline/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountUsd }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`preview ${res.status}`);
  return res.json();
}

export interface AgentResult {
  action: string;
  amountMinor?: number;
  currency?: string;
  target?: string;
  reply: string;
}

export async function sendAgentCommand(text: string): Promise<AgentResult> {
  const res = await fetch(`${BASE}/agent/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`agent ${res.status}`);
  return res.json();
}
