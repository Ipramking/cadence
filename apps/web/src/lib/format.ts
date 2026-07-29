export type Currency = "USD" | "NGN" | "USDC";

const MINOR: Record<Currency, number> = { USD: 100, NGN: 100, USDC: 1_000_000 };
const SYMBOL: Record<Currency, string> = { USD: "$", NGN: "₦", USDC: "" };

/** Format a minor-unit amount into a human string, e.g. (61000000, "NGN") -> "₦610,000". */
export function formatMoney(minor: number, currency: Currency): string {
  const major = minor / MINOR[currency];
  const body = major.toLocaleString("en-NG", {
    minimumFractionDigits: currency === "NGN" ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return currency === "USDC" ? `${body} USDC` : `${SYMBOL[currency]}${body}`;
}
