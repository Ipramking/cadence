"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Rings } from "@/components/Rings";
import { Sparkle } from "@/components/Sparkle";
import { getLiveBalances, getOverview, warmup, type LiveWallet } from "@/lib/api";
import { getReceipts, isSignedIn, type Receipt } from "@/lib/session";

function short(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export default function WalletPage() {
  const router = useRouter();
  const [live, setLive] = useState<LiveWallet[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace("/auth");
      return;
    }
    warmup();
    setReceipts(getReceipts());
    Promise.allSettled([
      getLiveBalances().then((r) => setLive(r.wallets)),
      getOverview().then((o) => setRate(o.rate.rate)),
    ]).finally(() => setLoading(false));
  }, [router]);

  // Total across the real on-chain wallets, valued in naira.
  const totalNgn = useMemo(() => {
    if (rate === null) return null;
    return live.reduce(
      (sum, w) => sum + (w.currency === "USD" ? w.balance.minor * rate : w.balance.minor),
      0,
    );
  }, [live, rate]);

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
          {loading ? (
            <span className="inline-block h-9 w-44 animate-pulse rounded-lg bg-surface2" />
          ) : totalNgn !== null ? (
            formatMoney(Math.round(totalNgn), "NGN")
          ) : (
            "—"
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          {loading ? "Reading balances from BMONI…" : `Real on-chain balance, valued at ₦${rate ?? "…"}/$.`}
        </p>
      </section>

      {/* On-chain wallets */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="label">On-chain wallets</h2>
          <Sparkle size={12} />
        </div>
        <div className="space-y-3">
          {loading && [0, 1].map((i) => <div key={i} className="card h-20 animate-pulse bg-surface2/40" />)}
          {!loading &&
            live.map((w) => (
              <div key={w.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {w.currency === "USD" ? "Dollar wallet · USDB" : "Naira wallet · CNGN"}
                  </p>
                  {w.address && <span className="code mt-1 inline-block">{short(w.address)}</span>}
                </div>
                <span className="stat text-lg">
                  {formatMoney(w.balance.minor, w.currency as "USD" | "NGN")}
                </span>
              </div>
            ))}
          {!loading && live.length === 0 && (
            <p className="text-sm text-muted">Couldn&apos;t reach BMONI — pull to refresh.</p>
          )}
          <div className="callout text-xs">
            Managed smart wallets created on <span className="code">BMONI</span> with cryptographic
            proof of ownership. Balances are live and settle as funds arrive.
          </div>
        </div>
      </section>

      {/* Payments */}
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
                <span className="code">{formatMoney(r.amountMinor, r.currency as "USD" | "NGN")}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
