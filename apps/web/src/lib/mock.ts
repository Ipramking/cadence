/**
 * Placeholder view data so the dashboard renders before the API is wired.
 * Replaced by live calls to @cadence/api once the backend routes land.
 */
import type { Currency } from "./format";

export const savedVsBankMinor = 4_732_00; // ₦47,320 saved this quarter

export interface WalletView {
  name: string;
  purpose: string;
  currency: Currency;
  balanceMinor: number;
  accent?: "gold" | "accent";
  goal?: { targetMinor: number };
}

export const wallets: WalletView[] = [
  { name: "Main", purpose: "USD received", currency: "USD", balanceMinor: 182_00 },
  { name: "Salary", purpose: "Monthly payout", currency: "NGN", balanceMinor: 180_000_00 },
  {
    name: "Rent vault",
    purpose: "Goal · due 30th",
    currency: "NGN",
    balanceMinor: 240_000_00,
    goal: { targetMinor: 300_000_00 },
    accent: "gold",
  },
  { name: "Send home", purpose: "Family support", currency: "NGN", balanceMinor: 40_000_00 },
  { name: "Hedge", purpose: "USD held", currency: "USDC", balanceMinor: 320_000_000 },
];

export type Risk = "clear" | "watch" | "high";

export interface ActivityView {
  id: string;
  title: string;
  detail: string;
  amount: string;
  risk: Risk;
  time: string;
}

export const activity: ActivityView[] = [
  {
    id: "tx_5",
    title: "Payment from Meridian Studio",
    detail: "Routed via stablecoin · saved ₦8,400 vs bank",
    amount: "+$500.00",
    risk: "clear",
    time: "2m ago",
  },
  {
    id: "tx_4",
    title: "Payment from unknown payer",
    detail: "Overpayment pattern · held for your review",
    amount: "+$1,200.00",
    risk: "high",
    time: "1h ago",
  },
  {
    id: "tx_3",
    title: "Allocation run",
    detail: "Salary ₦180k · Rent ₦120k · Home ₦40k",
    amount: "—",
    risk: "clear",
    time: "1h ago",
  },
  {
    id: "tx_2",
    title: "Payment from Talbot & Co",
    detail: "Received 03:14 · unusual hour, verified",
    amount: "+$340.00",
    risk: "watch",
    time: "yesterday",
  },
];
