import {
  BmoniError,
  type BmoniClient,
  type Currency,
  type FxRate,
  type Money,
  type SubWallet,
  type Transaction,
  type TransactionStatus,
  type TransactionType,
} from "@cadence/shared";
import { bmoniFetch } from "./http.js";

const scale = (c: Currency): number => (c === "USDC" ? 1_000_000 : 100);
const toMinor = (major: string | number, c: Currency): number =>
  Math.round(Number(major) * scale(c));
const toMajor = (m: Money): number => m.minor / scale(m.currency);

interface BalanceRow {
  smartWalletId: string;
  currency: Currency;
  balance: string;
}
interface RawTx {
  id: string;
  type?: string;
  status?: string;
  amount?: string;
  currency?: Currency;
  description?: string | null;
  createdAt?: string | null;
}

/**
 * Real BMONI sandbox client, scoped to one provisioned user (bmoniUserId).
 * Implements the money operations Cadence relies on. Sub-wallets ("vaults")
 * and outbound transfers are handled in the app layer — the provider only
 * exposes its own currency wallets and settlement.
 */
export class SandboxBmoniClient implements BmoniClient {
  constructor(private readonly userId: string) {
    if (!userId) throw new BmoniError("missing BMONI user id", "NO_USER");
  }

  private u(path: string): string {
    return `/v1/users/${this.userId}${path}`;
  }

  async getBalance(walletId: string): Promise<Money> {
    const r = await bmoniFetch<{ balance: string; currency: Currency }>(
      this.u(`/smart-wallets/${walletId}/balance`),
    );
    return { minor: toMinor(r.balance, r.currency), currency: r.currency };
  }

  async listWallets(): Promise<SubWallet[]> {
    const r = await bmoniFetch<{ balances: BalanceRow[] }>(
      this.u(`/smart-wallets/account/balances`),
    );
    return (r.balances ?? []).map((b) => ({
      id: b.smartWalletId,
      name: `${b.currency} wallet`,
      purpose: "main" as const,
      currency: b.currency,
      balance: { minor: toMinor(b.balance, b.currency), currency: b.currency },
      createdAt: new Date().toISOString(),
    }));
  }

  async createSubWallet(): Promise<SubWallet> {
    throw new BmoniError(
      "sub-wallets are tracked locally, not on the provider",
      "NOT_SUPPORTED",
    );
  }

  async listTransactions(params?: {
    limit?: number;
    since?: string;
    walletId?: string;
  }): Promise<Transaction[]> {
    const wallets = params?.walletId
      ? [{ id: params.walletId, currency: "NGN" as Currency }]
      : await this.listWallets();

    const all: Transaction[] = [];
    for (const w of wallets) {
      const r = await bmoniFetch<{ transactions: RawTx[] }>(
        this.u(`/smart-wallets/${w.id}/transactions`),
      );
      for (const t of r.transactions ?? []) all.push(this.mapTx(t, w.currency));
    }
    all.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const filtered = params?.since
      ? all.filter((t) => t.occurredAt >= params.since!)
      : all;
    return params?.limit ? filtered.slice(0, params.limit) : filtered;
  }

  async getRate(from: Currency, to: Currency): Promise<FxRate> {
    const r = await bmoniFetch<{ exchangeRate: string }>(
      this.u(`/exchange/rate/${from}/${to}`),
    );
    return { from, to, rate: Number(r.exchangeRate), asOf: new Date().toISOString() };
  }

  async convert(input: { amount: Money; to: Currency }): Promise<Transaction> {
    const r = await bmoniFetch<{ exchangeRate: string; convertedAmount: string }>(
      this.u(`/exchange/convert`),
      {
        method: "POST",
        body: { amount: toMajor(input.amount), from: input.amount.currency, to: input.to },
      },
    );
    return {
      id: `cvt_${Date.now()}`,
      type: "conversion",
      amount: { minor: toMinor(r.convertedAmount, input.to), currency: input.to },
      status: "settled",
      occurredAt: new Date().toISOString(),
      metadata: {
        rate: Number(r.exchangeRate),
        fromMinor: input.amount.minor,
        fromCurrency: input.amount.currency,
      },
    };
  }

  async transfer(): Promise<Transaction> {
    throw new BmoniError(
      "transfer requires a funded, KYC-activated wallet; simulate at the app layer",
      "NEEDS_FUNDING",
    );
  }

  private mapTx(t: RawTx, fallback: Currency): Transaction {
    const currency = t.currency ?? fallback;
    return {
      id: String(t.id),
      type: (t.type as TransactionType) ?? "inflow",
      status: (t.status as TransactionStatus) ?? "settled",
      amount: { minor: toMinor(t.amount ?? "0", currency), currency },
      occurredAt: t.createdAt ?? new Date().toISOString(),
      counterparty: t.description ?? undefined,
    };
  }
}
