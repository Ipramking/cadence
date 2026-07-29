/**
 * Cadence domain types — the shared contract between the API and the web app.
 * Money is always represented in minor units (e.g. cents / kobo) to avoid
 * floating-point drift. Never store money as a plain decimal.
 */

export type Currency = "USD" | "NGN" | "USDC";

export interface Money {
  /** Amount in minor units (USD cents, NGN kobo, USDC 1e6). */
  minor: number;
  currency: Currency;
}

export type WalletPurpose =
  | "main"
  | "salary"
  | "goal"
  | "family"
  | "hedge"
  | "reserve";

export interface SubWallet {
  id: string;
  name: string;
  purpose: WalletPurpose;
  currency: Currency;
  balance: Money;
  createdAt: string;
}

export type TransactionType =
  | "inflow"
  | "conversion"
  | "allocation"
  | "transfer"
  | "payout";

export type TransactionStatus = "pending" | "settled" | "flagged" | "failed";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: Money;
  status: TransactionStatus;
  /** Free-text label of the other party, e.g. a client name. */
  counterparty?: string;
  /** ISO timestamp. */
  occurredAt: string;
  /** Populated for conversions/transfers. */
  fromWalletId?: string;
  toWalletId?: string;
  metadata?: Record<string, unknown>;
}

export interface FxRate {
  from: Currency;
  to: Currency;
  /** Units of `to` per 1 unit of `from`. */
  rate: number;
  asOf: string;
}

export type ConversionPath = "direct" | "stablecoin-bridge";

export interface ConversionQuote {
  from: Currency;
  to: Currency;
  amount: Money;
  rate: number;
  path: ConversionPath;
  /** What the user receives after this path. */
  receives: Money;
  /** Estimated amount a typical bank would deliver, for comparison. */
  bankReceives: Money;
  /** receives - bankReceives, i.e. the saving. */
  savedVsBank: Money;
}

/** A rule the user configures for how incoming money is handled. */
export type RuleKind = "salary" | "goal" | "family" | "hedge";

export interface AllocationRule {
  id: string;
  kind: RuleKind;
  /** Human label, e.g. "Rent vault" or "Send home". */
  label: string;
  /** Percentage of an inflow this rule claims (0-100). */
  percentage: number;
  /** Optional target currency the claimed slice is converted into. */
  targetCurrency?: Currency;
  /** For goal rules. */
  goalId?: string;
  priority: number;
  enabled: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target: Money;
  saved: Money;
  deadline?: string;
}

/** The plan produced when an inflow is processed, before execution. */
export interface AllocationPlan {
  inflowId: string;
  items: AllocationItem[];
  /** Anything left unallocated stays in the main wallet. */
  remainder: Money;
}

export interface AllocationItem {
  ruleId: string;
  label: string;
  kind: RuleKind;
  amount: Money;
  /** Present when the slice is converted before landing. */
  quote?: ConversionQuote;
  targetWalletId: string;
}

export type RiskLevel = "clear" | "watch" | "high";

export interface RiskAssessment {
  transactionId: string;
  level: RiskLevel;
  score: number;
  /** Plain-language reasons, safe to show the user. */
  reasons: string[];
}
