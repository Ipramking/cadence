const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Resilient request — retries through the backend's free-tier cold start
 * (which can take ~30–50s) with a per-attempt timeout, so the UI recovers
 * instead of hanging on a stuck "connecting" state.
 */
async function req<T>(path: string, init: RequestInit = {}, tries = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${BASE}${path}`, { cache: "no-store", ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${path} ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr;
}

const get = <T>(path: string) => req<T>(path);
const post = <T>(path: string, body: unknown) =>
  req<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const put = <T>(path: string, body: unknown) =>
  req<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Wake the backend early (and keep it warm while the app is open). */
export function warmup(): void {
  req("/health", {}, 6).catch(() => {});
}

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

export const getOverview = () => get<Overview>("/overview");
export const getWallets = () => get<OverviewWallet[]>("/wallets");

export interface ApiTransaction {
  id: string;
  type: string;
  amount: { minor: number; currency: string };
  status: string;
  counterparty?: string;
  occurredAt: string;
  metadata?: { risk?: string; riskReasons?: string[] } & Record<string, unknown>;
}

export const getTransactions = (limit = 8) =>
  get<ApiTransaction[]>(`/transactions?limit=${limit}`);

export interface InflowPreview {
  amountUsd: number;
  rate: number;
  currency: string;
  receivesMinor: number;
  savedVsBankMinor: number;
}

export const previewInflow = (amountUsd: number) =>
  post<InflowPreview>("/pipeline/preview", { amountUsd });

export interface AgentResult {
  action: string;
  amountMinor?: number;
  currency?: string;
  target?: string;
  reply: string;
}

export const sendAgentCommand = (text: string) =>
  post<AgentResult>("/agent/command", { text });

export interface LiveWallet {
  id: string;
  currency: string;
  balance: { minor: number; currency: string };
  address?: string;
}

export interface LiveBalances {
  configured: boolean;
  wallets: LiveWallet[];
}

export const getLiveBalances = () => get<LiveBalances>("/live/balances");

export interface LiveConvertResult {
  configured: boolean;
  amountUsd: number;
  tx: { amount: { minor: number; currency: string }; metadata: { rate: number } };
  before: LiveWallet[];
  after: LiveWallet[];
}

export const runLiveConvert = (amountUsd: number) =>
  post<LiveConvertResult>("/live/convert", { amountUsd });

export interface LiveSendResult {
  configured: boolean;
  amountUsd: number;
  result: { ok: boolean; step: string; error?: string };
  before: LiveWallet[];
  after: LiveWallet[];
}

export const runLiveSend = (amountUsd: number) =>
  post<LiveSendResult>("/live/send", { amountUsd });

// ── Agentic engine ──
export interface AgentRoute {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  sourceMinor: number;
  targetMinor: number;
}

export interface Payee {
  name: string;
  phone?: string;
  userId?: string;
  known: boolean;
}

export interface AgentActResult {
  intent: string;
  amountMinor?: number;
  currency?: "USD" | "NGN";
  targetCurrency?: "USD" | "NGN";
  recipient?: string;
  reply: string;
  serious: boolean;
  route?: AgentRoute | null;
  payee?: Payee | null;
  needsConfirm: boolean;
}

export const agentAct = (text: string, sourceCurrency: "USD" | "NGN" = "USD") =>
  post<AgentActResult>("/agent/act", { text, sourceCurrency });

export interface ParsedPayment {
  recipient?: string;
  amountMinor?: number;
  currency?: "USD" | "NGN";
  bank?: string;
  account?: string;
  note?: string;
}

export const parsePaymentImage = (image: string, mimeType: string) =>
  post<ParsedPayment>("/agent/parse-image", { image, mimeType });

export interface PayResult {
  ok: boolean;
  error?: string;
  receipt?: {
    id: string;
    recipient: string;
    phone?: string | null;
    amountMinor: number;
    currency: string;
    route?: AgentRoute | null;
    note?: string | null;
    at: string;
  };
}

export const payAgent = (input: {
  recipient: string;
  amountMinor: number;
  currency: "USD" | "NGN";
  sourceCurrency?: "USD" | "NGN";
  phone?: string;
  note?: string;
}) => post<PayResult>("/agent/pay", input);

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

export const getRules = () => get<Rule[]>("/rules");
export const updateRule = (id: string, patch: Partial<Rule>) =>
  put<Rule>(`/rules/${id}`, patch);
