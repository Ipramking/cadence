"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import {
  activity,
  savedVsBankMinor,
  wallets,
  type Risk,
} from "@/lib/mock";

const riskStyles: Record<Risk, string> = {
  clear: "text-accent bg-accent-soft",
  watch: "text-warn bg-[rgba(251,191,36,0.12)]",
  high: "text-danger bg-[rgba(248,113,113,0.12)]",
};

const pipelineStages = [
  { key: "guard", label: "Guarded", note: "Verified — not the overpayment pattern" },
  { key: "route", label: "Routed", note: "Via stablecoin — saved ₦8,400 vs bank" },
  { key: "allocate", label: "Allocated", note: "Salary ₦180k · Rent ₦120k · Home ₦40k" },
] as const;

export default function Dashboard() {
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);

  function runPipeline() {
    if (running) return;
    setRunning(true);
    setStep(-1);
    pipelineStages.forEach((_, i) => {
      setTimeout(() => {
        setStep(i);
        if (i === pipelineStages.length - 1) setRunning(false);
      }, 700 * (i + 1));
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cadence</h1>
          <p className="text-sm text-muted">Your cross-border money, on autopilot.</p>
        </div>
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Sandbox · test data
        </span>
      </header>

      {/* Hero + pipeline */}
      <section className="mb-6 grid gap-4 md:grid-cols-5">
        <div className="card md:col-span-2 flex flex-col justify-between">
          <span className="label">Saved vs your bank · this quarter</span>
          <div className="mt-3">
            <div className="text-4xl font-semibold tracking-tight text-gold">
              {formatMoney(savedVsBankMinor, "NGN")}
            </div>
            <p className="mt-2 text-sm text-muted">
              Smarter routing and timing on every dollar you received.
            </p>
          </div>
        </div>

        <div className="card md:col-span-3">
          <div className="flex items-center justify-between">
            <span className="label">Incoming payment</span>
            <button
              onClick={runPipeline}
              disabled={running}
              className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-black transition disabled:opacity-50"
            >
              {running ? "Working…" : "Simulate $500"}
            </button>
          </div>
          <ol className="mt-4 space-y-2.5">
            {pipelineStages.map((s, i) => {
              const active = step >= i;
              return (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                    active ? "border-border bg-surface2" : "border-transparent opacity-40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      active ? "bg-accent text-black" : "bg-surface2 text-muted"
                    }`}
                  >
                    {active ? "✓" : i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted">{s.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Wallets */}
      <section className="mb-6">
        <h2 className="label mb-3">Wallets</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((w) => {
            const pct = w.goal
              ? Math.min(100, Math.round((w.balanceMinor / w.goal.targetMinor) * 100))
              : null;
            return (
              <div key={w.name} className="card">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{w.name}</span>
                  <span className="text-xs text-muted">{w.currency}</span>
                </div>
                <div
                  className={`mt-2 stat ${w.accent === "gold" ? "text-gold" : ""}`}
                >
                  {formatMoney(w.balanceMinor, w.currency)}
                </div>
                <p className="mt-1 text-xs text-muted">{w.purpose}</p>
                {pct !== null && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Activity */}
      <section className="mb-24">
        <h2 className="label mb-3">Recent activity</h2>
        <div className="card divide-y divide-border p-0">
          {activity.map((a) => (
            <div key={a.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="truncate text-xs text-muted">{a.detail}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${riskStyles[a.risk]}`}>
                {a.risk}
              </span>
              <div className="w-24 text-right">
                <p className="text-sm">{a.amount}</p>
                <p className="text-xs text-muted">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <input
            placeholder="Tell Cadence what to do — “send home ₦60k this month”"
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
          <button className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-black">
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
