import type {
  Currency,
  FxRate,
  Money,
  SubWallet,
  Transaction,
} from "./types.js";

/**
 * The single seam through which Cadence touches money.
 *
 * Two implementations exist:
 *  - MockBmoniClient      — seeded test data, powers local dev and demos.
 *  - SandboxBmoniClient   — real BMONI sandbox, filled in when API creds land.
 *
 * Nothing in the app may call a money provider directly. Every balance read,
 * rate lookup, conversion and transfer goes through this interface so the
 * provider can be swapped without touching business logic.
 */
export interface BmoniClient {
  /** Current balance of a wallet / sub-wallet. */
  getBalance(walletId: string): Promise<Money>;

  /** List sub-wallets held by the user. */
  listWallets(): Promise<SubWallet[]>;

  /** Create a purpose-specific sub-wallet (salary, goal, family, hedge...). */
  createSubWallet(input: {
    name: string;
    currency: Currency;
    purpose: SubWallet["purpose"];
  }): Promise<SubWallet>;

  /** Recent transactions, newest first. */
  listTransactions(params?: {
    limit?: number;
    since?: string;
    walletId?: string;
  }): Promise<Transaction[]>;

  /** Current FX rate for a pair. */
  getRate(from: Currency, to: Currency): Promise<FxRate>;

  /** Move value between two currencies, returning the settled transaction. */
  convert(input: {
    amount: Money;
    to: Currency;
    fromWalletId?: string;
    toWalletId?: string;
  }): Promise<Transaction>;

  /** Move value between wallets or out to a recipient. */
  transfer(input: {
    amount: Money;
    fromWalletId: string;
    toWalletId?: string;
    recipientRef?: string;
  }): Promise<Transaction>;
}

/** Thrown when a provider rejects an operation. */
export class BmoniError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "BmoniError";
  }
}
