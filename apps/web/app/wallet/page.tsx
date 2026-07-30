"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Rings } from "@/components/Rings";
import { Sparkle } from "@/components/Sparkle";
import {
  getLiveBalances,
  getOverview,
  getWallets,
  type LiveWallet,
  type OverviewWallet,
} from "@/lib/api";
import { getReceipts, isSignedIn, type Receipt } from "@/lib/session";

const PURPOSE: Record<string, string> = {
  main: "Main balance",
  salary: "Salary",
  goal: "Savings goal",
  family: "Family support",
  hedge: "USD hedge",
  reserve: "Reserve",
};

function short(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export default function WalletPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<OverviewWallet[]>([]);
  const [live, setLive] = useState<LiveWallet[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace("/auth");
      return;
    }
    getWallets().then(setWallets).catch(() => setWallets([]));
    getLiveBalances().then((r) => setLive(r.wallets)).catch(() => setLive([]));
    getOverview().then((o) => setRate(o.rate.rate)).catch(() => setRate(null));
    setReceipts(getReceipts());
  }, [router]);

  // Total, expressed in naira using the live rate.
  const totalNgn = useMemo(() => {
    if (!rate) return null;
    return wallets.reduce((sum, w) => {
      const minor = w.balance.minor;
      return sum + (w.balance.currency === "USD" ? minor * rate : minor);
    }, 0);
  }, [wallets, rate]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="flex items-center justify-between">
        <Link href="/app" className="text-sm text-muted transition hover:text-ink">← Home</Link>
        <span className="chip">wallet</span>
      </header>

      {/* Total */}
      <section className="relative mt-5 overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <div className="pointer-events-none absolute -right-16 -top-12 opacity-40">
          <Rings size={190} progress={0.68} spin />
        </div>
        <span className="label">Total balance</span>
        <div className="stat mt-2 text-4xl">
          {totalNgn !== null ? formatMoney(Math.round(totalNgn), "NGN") : "—"}
        </div>
        <p className="mt-1 text-xs text-muted">Across all wallets, valued at ₦{rate ?? "…"}/$.</p>
      </section>

      {/* Wallets */}
      <section className="mt-6">
        <h2 className="label mb-3">Your money</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {wallets.map((w) => (
            <div key={w.id} className="card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{PURPOSE[w.purpose] ?? w.name}</span>
                <span className="text-xs text-muted">{w.balance.currency}</span>
              </div>
              <div className="stat mt-1.5 text-xl">
                {formatMoney(w.balance.minor, w.balance.currency as "USD" | "NGN")}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* On-chain */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="label">On-chain wallets</h2>
          <Sparkle size={12} />
        </div>
        <div className="space-y-3">
          {live.length === 0 && <p className="text-sm text-muted">Connecting to BMONI…</p>}
          {live.map((w) => (
            <div key={w.id} className="card flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {w.currency === "USD" ? "USD wallet · USDB" : "Naira wallet · CNGN"}
                </p>
                {w.address && <span className="code mt-1 inline-block">{short(w.address)}</span>}
              </div>
              <span className="stat text-lg">
                {formatMoney(w.balance.minor, w.currency as "USD" | "NGN")}
              </span>
            </div>
          ))}
          <p className="text-xs text-muted">
            Managed smart wallets created on BMONI with cryptographic proof of ownership.
          </p>
        </div>
      </section>

      {/* Receipts */}
      {receipts.length > 0 && (
        <section className="mt-6 mb-10">
          <h2 className="label mb-3">Payments</h2>
          <div className="card divide-y divide-border p-0">
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{r.recipient}</p>
                  <p className="text-xs text-muted">{new Date(r.at).toLocaleString()}</p>
                </div>
                <span className="stat text-base">
                  {formatMoney(r.amountMinor, r.currency as "USD" | "NGN")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
