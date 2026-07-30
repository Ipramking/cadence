"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { Rings } from "@/components/Rings";
import { SendSheet } from "@/components/SendSheet";
import { getTransactions, getWallets, type ApiTransaction, type OverviewWallet } from "@/lib/api";

const PURPOSE: Record<string, string> = {
  main: "Main balance",
  salary: "Salary",
  goal: "Goal",
  family: "Family",
  hedge: "USD hedge",
  reserve: "Reserve",
};

export function ManualHome() {
  const [wallets, setWallets] = useState<OverviewWallet[]>([]);
  const [txns, setTxns] = useState<ApiTransaction[]>([]);
  const [send, setSend] = useState(false);

  useEffect(() => {
    getWallets().then(setWallets).catch(() => setWallets([]));
    getTransactions(8).then(setTxns).catch(() => setTxns([]));
  }, []);

  const primary = wallets.find((w) => w.purpose === "main") ?? wallets[0];

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="flex items-center justify-between">
        <span className="text-lg font-extrabold tracking-tight">Cadence</span>
        <div className="flex items-center gap-2">
          <Link href="/wallet" className="btn-ghost px-3 py-1.5 text-xs">Wallet</Link>
          <Link href="/settings" className="btn-ghost px-3 py-1.5 text-xs">Settings</Link>
        </div>
      </header>

      {/* Balance hero */}
      <section className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <div className="pointer-events-none absolute -right-16 -top-12 opacity-40">
          <Rings size={180} progress={0.62} spin />
        </div>
        <span className="label">Available balance</span>
        <div className="stat mt-2 text-4xl">
          {primary ? formatMoney(primary.balance.minor, primary.balance.currency as "USD" | "NGN") : "—"}
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setSend(true)} className="btn-primary flex-1">Send</button>
          <Link href="/setup" className="btn-ghost flex-1">Plan</Link>
        </div>
      </section>

      {/* Wallets */}
      <section className="mt-6">
        <h2 className="label mb-3">Your wallets</h2>
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

      {/* Activity */}
      <section className="mt-6 mb-10">
        <h2 className="label mb-3">Recent activity</h2>
        <div className="card divide-y divide-border p-0">
          {txns.map((t) => {
            const risk = (t.metadata?.risk as string) ?? (t.status === "flagged" ? "high" : "clear");
            const sym = t.amount.currency === "USD" ? "$" : "₦";
            return (
              <div key={t.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.counterparty ?? `${t.type} transaction`}</p>
                  <p className="truncate text-xs text-muted">{t.type} · {t.status}</p>
                </div>
                {risk !== "clear" && (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${risk === "high" ? "text-danger bg-[rgba(247,109,109,0.14)]" : "text-warn bg-[rgba(230,178,77,0.14)]"}`}>
                    {risk}
                  </span>
                )}
                <span className="text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t.type === "inflow" ? "+" : ""}{sym}{(t.amount.minor / 100).toLocaleString()}
                </span>
              </div>
            );
          })}
          {txns.length === 0 && <p className="p-4 text-sm text-muted">No activity yet.</p>}
        </div>
      </section>

      {send && <SendSheet onClose={() => setSend(false)} />}
    </main>
  );
}
