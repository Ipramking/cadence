const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "cadence_token";

export function getToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

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
      const res = await fetch(`${BASE}${path}`, {
        cache: "no-store",
        ...init,
        headers: { ...(init.headers ?? {}), ...authHeader() },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      // A rejected token (e.g. signed before a secret rotation) shouldn't trap
      // the user: drop it and send them to sign in again. Login/signup handle
      // their own 401s (wrong password), so leave those to the form.
      if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/signup")) {
        clearToken();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth";
        }
        throw new Error(`${path} 401`);
      }
      // Client errors (4xx) won't be fixed by retrying — fail fast.
      if (res.status >= 400 && res.status < 500) throw new Error(`${path} ${res.status}`);
      if (!res.ok) throw new Error(`${path} ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : "";
      if (/\b4\d\d$/.test(msg)) throw e; // client error — do not retry
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
  simulated?: boolean;
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

export interface ChatSlots {
  amountMinor?: number;
  currency?: "USD" | "NGN";
  phone?: string;
  recipient?: string;
  bank?: string;
  accountNumber?: string;
  provider?: string;
  meterNumber?: string;
  smartcard?: string;
  plan?: string;
  fromCurrency?: "USD" | "NGN";
  toCurrency?: "USD" | "NGN";
  note?: string;
}

export type Risk = "low" | "medium" | "high";

export interface ChatResult {
  type: string;
  slots: ChatSlots;
  missing: string[];
  ready: boolean;
  reply: string;
  route?: AgentRoute | null;
  payee?: Payee | null;
  risk?: Risk;
}

export const agentChat = (messages: { role: "user" | "agent"; text: string }[]) =>
  post<ChatResult>("/agent/chat", { messages });

export interface ExecReceipt {
  id: string;
  reference: string;
  txType: string;
  recipient: string;
  amountMinor: number;
  currency: string;
  route?: AgentRoute | null;
  at: string;
}

export const executeTx = (input: {
  type: string;
  slots: ChatSlots;
  route?: AgentRoute | null;
  note?: string;
}) =>
  post<{ ok: boolean; receipt?: ExecReceipt; error?: string; code?: string }>(
    "/agent/execute",
    input,
  );

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

// ── Auth ──
export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  autonomy: "manual" | "hybrid" | "automatic";
  planEnabled: boolean;
  onboarded: boolean;
  hasPin: boolean;
  hasSafeWord: boolean;
  bmoniUserId?: string | null;
  cngnAddress?: string | null;
  usdbAddress?: string | null;
}

export const signup = (body: { email: string; password: string; name?: string; phone?: string }) =>
  post<{ token: string; user: AuthUser }>("/auth/signup", body);

export const login = (body: { email: string; password: string }) =>
  post<{ token: string; user: AuthUser }>("/auth/login", body);

export const authMe = () => get<{ user: AuthUser }>("/auth/me");

export interface PrefsBody {
  name?: string;
  phone?: string;
  autonomy?: "manual" | "hybrid" | "automatic";
  planEnabled?: boolean;
  pin?: string;
  safeWord?: string;
}

// Provisions the user's BMONI wallets (best-effort) + saves prefs. Runs once, at onboarding.
export const onboardUser = (body: PrefsBody) =>
  post<{ user: AuthUser; provisioned?: boolean }>("/auth/onboard", body);

// Saves preferences only — never provisions. Used after onboarding + in settings.
export const savePrefs = (body: PrefsBody) => put<{ user: AuthUser }>("/auth/prefs", body);

export const getServerReceipts = () => get<{ receipts: ExecReceipt[] }>("/receipts");

// ── Trust Architecture: spending guardrails + freeze ──
export interface Policy {
  perPaymentCapMinor: number | null;
  dailyCapMinor: number | null;
  allowlistOnly: boolean;
  agentFrozen: boolean;
}

export const getPolicy = () => get<{ policy: Policy }>("/policy");
export const updatePolicy = (patch: Partial<Policy>) =>
  put<{ policy: Policy }>("/policy", patch);
export const freezeAgent = (frozen: boolean) =>
  post<{ policy: Policy }>("/policy/freeze", { frozen });
