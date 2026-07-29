"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import {
  getOverview,
  previewInflow,
  sendAgentCommand,
  type InflowPreview,
} from "@/lib/api";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Dashboard() {
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [preview, setPreview] = useState<InflowPreview | null>(null);
  const [agentText, setAgentText] = useState("");
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);

  async function sendAgent() {
    const text = agentText.trim();
    if (!text || agentBusy) return;
    setAgentBusy(true);
    setAgentReply(null);
    try {
      const res = await sendAgentCommand(text);
      setAgentReply(res.reply);
      setAgentText("");
    } catch {
      setAgentReply("I couldn't reach the agent just now — try again.");
    }
    setAgentBusy(false);
  }

  // Pull the live USD/NGN rate on load.
  useEffect(() => {
    getOverview()
      .then((o) => setRate(o.rate.rate))
      .catch(() => setRate(null));
  }, []);

  const stages = [
    { label: "Guarded", note: "Verified — not the overpayment pattern" },
    {
      label: "Routed",
      note: preview
        ? `Converted at ₦${preview.rate.toFixed(2)}/$ — saved ${formatMoney(preview.savedVsBankMinor, "NGN")} vs bank`
        : "Routed via the cheapest path",
    },
    {
      label: "Allocated",
      note: preview
        ? `${formatMoney(preview.receivesMinor, "NGN")} → salary, rent vault, home`
        : "Salary ₦180k · Rent ₦120k · Home ₦40k",
    },
  ];

  async function runPipeline() {
    if (running) return;
    setRunning(true);
    setStep(-1);
    setPreview(null);
    try {
      setPreview(await previewInflow(500));
    } catch {
      // API offline — fall back to the static narrative
    }
    for (let i = 0; i < stages.length; i++) {
      await sleep(650);
      setStep(i);
    }
    setRunning(false);
  }

  const heroSaved = preview?.savedVsBankMinor ?? savedVsBankMinor;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cadence</h1>
          <p className="text-sm text-muted">Your cross-border money, on autopilot.</p>
        </div>
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {rate ? `Live ₦${rate.toFixed(2)}/$` : "Sandbox · test data"}
        </span>
      </header>

      {/* Hero + pipeline */}
      <section className="mb-6 grid gap-4 md:grid-cols-5">
        <div className="card md:col-span-2 flex flex-col justify-between">
          <span className="label">Saved vs your bank{preview ? " · this payment" : " · this quarter"}</span>
          <div className="mt-3">
            <div className="text-4xl font-semibold tracking-tight text-gold">
              {formatMoney(heroSaved, "NGN")}
            </div>
            <p className="mt-2 text-sm text-muted">
              Smarter routing and timing on every dollar you receive.
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
            {stages.map((s, i) => {
              const active = step >= i;
              return (
                <li
                  key={s.label}
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
                <div className={`mt-2 stat ${w.accent === "gold" ? "text-gold" : ""}`}>
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
        <div className="mx-auto max-w-5xl px-5 py-3">
          {agentReply && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-border bg-surface2 px-3 py-2 text-sm">
              <span className="mt-0.5 text-accent">✦</span>
              <p className="text-ink">{agentReply}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              value={agentText}
              onChange={(e) => setAgentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendAgent()}
              disabled={agentBusy}
              placeholder="Tell Cadence what to do — “send home ₦60k this month”"
              className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
            />
            <button
              onClick={sendAgent}
              disabled={agentBusy || !agentText.trim()}
              className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-black transition disabled:opacity-50"
            >
              {agentBusy ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
