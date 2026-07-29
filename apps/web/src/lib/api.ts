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

export async function getWallets(): Promise<OverviewWallet[]> {
  const res = await fetch(`${BASE}/wallets`, { cache: "no-store" });
  if (!res.ok) throw new Error(`wallets ${res.status}`);
  return res.json();
}

export interface ApiTransaction {
  id: string;
  type: string;
  amount: { minor: number; currency: string };
  status: string;
  counterparty?: string;
  occurredAt: string;
  metadata?: { risk?: string; riskReasons?: string[] } & Record<string, unknown>;
}

export async function getTransactions(limit = 8): Promise<ApiTransaction[]> {
  const res = await fetch(`${BASE}/transactions?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`transactions ${res.status}`);
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

export interface LiveWallet {
  id: string;
  currency: string;
  balance: { minor: number; currency: string };
}

export interface LiveBalances {
  configured: boolean;
  wallets: LiveWallet[];
}

export async function getLiveBalances(): Promise<LiveBalances> {
  const res = await fetch(`${BASE}/live/balances`, { cache: "no-store" });
  if (!res.ok) throw new Error(`live balances ${res.status}`);
  return res.json();
}

export interface LiveConvertResult {
  configured: boolean;
  amountUsd: number;
  tx: { amount: { minor: number; currency: string }; metadata: { rate: number } };
  before: LiveWallet[];
  after: LiveWallet[];
}

export async function runLiveConvert(amountUsd: number): Promise<LiveConvertResult> {
  const res = await fetch(`${BASE}/live/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountUsd }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`live convert ${res.status}`);
  return res.json();
}

export interface Rule {
  id: string;
  kind: "salary" | "goal" | "family" | "hedge";
  label: string;
  percentage: number;
  targetCurrency?: string | null;
  goalId?: string | null;
  priority: number;
  enabled: boolean;
}

export async function getRules(): Promise<Rule[]> {
  const res = await fetch(`${BASE}/rules`, { cache: "no-store" });
  if (!res.ok) throw new Error(`rules ${res.status}`);
  return res.json();
}

export async function updateRule(id: string, patch: Partial<Rule>): Promise<Rule> {
  const res = await fetch(`${BASE}/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`updateRule ${res.status}`);
  return res.json();
}
